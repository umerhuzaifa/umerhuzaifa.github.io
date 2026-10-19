"""
tracer.py - execution tracer for the CSC 241 Python Visualizer.

Runs a student's program under sys.settrace and records, for every executed
line, a snapshot of:  the global frame, every active function frame, and every
object reachable from them (the "heap").  The UI replays these snapshots, so
stepping backward is free.

Entry point:  run_trace(code, input_cb=None, max_steps=2000) -> JSON string
"""
import builtins
import json
import sys
import traceback
import types

USER_FILE = "<user_code>"
MAX_ITEMS = 60          # max elements shown per container
MAX_STR = 100           # max characters shown per string / repr
COMPREHENSIONS = {"<listcomp>", "<dictcomp>", "<setcomp>", "<genexpr>"}
SKIP_EXC = (StopIteration, GeneratorExit, KeyboardInterrupt)


class _TraceLimit(BaseException):
    """Raised inside the trace function to stop runaway programs."""


class _Out:
    """Stand-in for sys.stdout that remembers everything printed."""

    def __init__(self):
        self.parts = []
        self.n = 0

    def write(self, s):
        if not isinstance(s, str):
            s = str(s)
        self.parts.append(s)
        self.n += len(s)
        return len(s)

    def flush(self):
        pass

    def isatty(self):
        return False

    def getvalue(self):
        return "".join(self.parts)


def _clip(s, limit=MAX_STR):
    return s if len(s) <= limit else s[:limit] + "…"


def _safe_repr(v):
    try:
        return _clip(repr(v))
    except BaseException:
        return "<unprintable %s>" % type(v).__name__


class _Tracer:
    def __init__(self, max_steps):
        self.max_steps = max_steps
        self.out = _Out()
        self.trace = []
        self.user_globals = {}
        self.ids = {}            # id(obj) -> small display id
        self.keep = []           # keep objects alive so ids are never reused
        self.next_id = 1
        self.fids = {}           # frame -> call number (f1, f2, ...)
        self.next_fid = 1
        self.seen_exc = {}       # id(exc) -> exc  (record each exception once)
        self.exc_step = {}       # id(exc) -> index of step in self.trace
        self.last_line = 1

    # ----------------------------------------------------------- encoding --
    def _oid(self, o):
        k = id(o)
        if k not in self.ids:
            self.ids[k] = self.next_id
            self.next_id += 1
            self.keep.append(o)
        return self.ids[k]

    def enc(self, v, heap):
        """Encode a value: ["p", type, text] for primitives, ["r", id] for heap refs."""
        t = type(v)
        try:
            if v is None:
                return ["p", "NoneType", "None"]
            if t is bool:
                return ["p", "bool", repr(v)]
            if t is int:
                return ["p", "int", _clip(repr(v), 40)]
            if t is float:
                return ["p", "float", repr(v)]
            if t is complex:
                return ["p", "complex", repr(v)]
            if t is str:
                return ["p", "str", _clip(repr(v))]
            if t in (bytes, bytearray, range):
                return ["p", t.__name__, _safe_repr(v)]
            if isinstance(v, types.ModuleType):
                return ["p", "module", getattr(v, "__name__", "?")]
            if isinstance(v, (types.BuiltinFunctionType, types.BuiltinMethodType)):
                return ["p", "builtin", _safe_repr(v)]
        except BaseException:
            return ["p", t.__name__, "?"]

        oid = self._oid(v)
        if oid in heap:
            return ["r", oid]
        heap[oid] = {}                      # placeholder stops cycles

        if isinstance(v, (list, tuple, set, frozenset)):
            if isinstance(v, list):
                kind = "list" if t is list else t.__name__
            elif isinstance(v, tuple):
                kind = "tuple" if t is tuple else t.__name__
            else:
                kind = "set" if t is set else t.__name__
            try:
                items = list(v)
            except BaseException:
                items = []
            shown = items[:MAX_ITEMS]
            heap[oid] = {"t": kind, "items": [self.enc(x, heap) for x in shown],
                         "more": len(items) - len(shown)}
        elif isinstance(v, dict):
            pairs = list(v.items())
            shown = pairs[:MAX_ITEMS]
            heap[oid] = {"t": "dict" if t is dict else t.__name__,
                         "pairs": [[self.enc(k, heap), self.enc(x, heap)] for k, x in shown],
                         "more": len(pairs) - len(shown)}
        elif isinstance(v, types.FunctionType):
            c = v.__code__
            n = c.co_argcount + c.co_kwonlyargcount
            heap[oid] = {"t": "function", "name": v.__name__,
                         "params": ", ".join(c.co_varnames[:n]), "line": c.co_firstlineno}
        elif isinstance(v, type) and getattr(v, "__module__", "") == "__main__":
            attrs = []
            for k, x in list(vars(v).items()):
                if k.startswith("__"):
                    continue
                attrs.append([k, self.enc(x, heap)])
            heap[oid] = {"t": "class", "name": v.__name__, "attrs": attrs}
        elif getattr(t, "__module__", "") == "__main__" and hasattr(v, "__dict__"):
            attrs = [[k, self.enc(x, heap)] for k, x in list(vars(v).items())]
            heap[oid] = {"t": "instance", "cls": t.__name__, "attrs": attrs}
        else:
            heap[oid] = {"t": "other", "type": t.__name__, "text": _safe_repr(v)}
        return ["r", oid]

    # ----------------------------------------------------------- snapshot --
    def snapshot(self, frame, ev, arg=None):
        heap = {}
        globs = []
        for k, v in list(self.user_globals.items()):
            if k.startswith("__") and k.endswith("__"):
                continue
            globs.append([k, self.enc(v, heap)])

        chain = []
        f = frame
        while f is not None:
            c = f.f_code
            if c.co_filename == USER_FILE and c.co_name != "<module>" \
                    and c.co_name not in COMPREHENSIONS:
                chain.append(f)
            f = f.f_back
        chain.reverse()

        stack = []
        for f in chain:
            locs = []
            try:
                items = list(dict(f.f_locals).items())
            except BaseException:
                items = []
            for k, v in items:
                if k.startswith(".") or (k.startswith("__") and k.endswith("__")):
                    continue
                locs.append([k, self.enc(v, heap)])
            stack.append({"fn": self.fids.get(f, 0), "name": f.f_code.co_name,
                          "line": f.f_lineno, "locals": locs, "top": f is frame})

        line = frame.f_lineno if frame is not None else self.last_line
        step = {"line": line, "ev": ev, "globals": globs, "stack": stack,
                "heap": heap, "out": self.out.n}
        if ev == "return":
            step["ret"] = self.enc(arg, heap)
        return step

    def record(self, frame, ev, arg=None):
        if len(self.trace) >= self.max_steps:
            raise _TraceLimit()
        step = self.snapshot(frame, ev, arg)
        self.last_line = step["line"]
        self.trace.append(step)
        return step

    # ------------------------------------------------------------- tracing --
    def global_trace(self, frame, event, arg):
        code = frame.f_code
        if code.co_filename != USER_FILE or code.co_name in COMPREHENSIONS:
            return None
        if event == "call" and frame not in self.fids and code.co_name != "<module>":
            self.fids[frame] = self.next_fid
            self.next_fid += 1
        return self.local_trace

    def local_trace(self, frame, event, arg):
        if event == "line":
            self.record(frame, "line")
        elif event == "return":
            if frame.f_code.co_name != "<module>":
                self.record(frame, "return", arg)
        elif event == "exception":
            exc = arg[1]
            if isinstance(exc, SKIP_EXC) or id(exc) in self.seen_exc:
                return self.local_trace
            self.seen_exc[id(exc)] = exc
            step = self.record(frame, "exception")
            step["exc"] = _clip("".join(traceback.format_exception_only(arg[0], exc)).strip(), 200)
            self.exc_step[id(exc)] = len(self.trace) - 1
        return self.local_trace

    def make_input(self, cb):
        out = self.out

        def _input(prompt=""):
            prompt = str(prompt)
            out.write(prompt)
            if cb is None:
                raise EOFError("EOF when reading a line")
            v = cb(prompt)
            if v is None or v == "\x00EOF":
                raise EOFError("EOF when reading a line")
            v = str(v)
            out.write(v + "\n")
            return v
        return _input


def run_trace(code, input_cb=None, max_steps=2000):
    """Run `code` and return the full execution trace as a JSON string."""
    result = {"ok": True, "trace": [], "output": "", "error": None, "truncated": False}
    try:
        compiled = compile(code, USER_FILE, "exec")
    except SyntaxError as e:
        result.update(ok=False, error={"kind": type(e).__name__, "msg": e.msg or "invalid syntax",
                                       "line": e.lineno or 1})
        return json.dumps(result)
    except BaseException as e:
        result.update(ok=False, error={"kind": type(e).__name__, "msg": str(e), "line": 1})
        return json.dumps(result)

    tr = _Tracer(max_steps)
    g = {"__name__": "__main__", "__builtins__": builtins}
    tr.user_globals = g
    old_out, old_in = sys.stdout, builtins.input
    sys.stdout = tr.out
    builtins.input = tr.make_input(input_cb)
    uncaught = None
    try:
        sys.settrace(tr.global_trace)
        try:
            exec(compiled, g)
        finally:
            sys.settrace(None)
    except _TraceLimit:
        result["truncated"] = True
    except SystemExit:
        pass
    except BaseException as e:
        uncaught = e
    finally:
        sys.stdout, builtins.input = old_out, old_in
        sys.settrace(None)

    trace = tr.trace
    if uncaught is not None:
        idx = tr.exc_step.get(id(uncaught))
        msg = _clip("".join(traceback.format_exception_only(type(uncaught), uncaught)).strip(), 200)
        if idx is not None:
            del trace[idx + 1:]
            trace[idx]["ev"] = "uncaught"
            trace[idx]["exc"] = msg
            line = trace[idx]["line"]
        else:
            line = tr.last_line
        result["error"] = {"kind": type(uncaught).__name__, "msg": str(uncaught), "line": line,
                           "text": msg}
    elif not result["truncated"]:
        try:
            trace.append(tr.snapshot(None, "done"))
        except BaseException:
            pass

    result["trace"] = trace
    result["output"] = tr.out.getvalue()
    return json.dumps(result)
