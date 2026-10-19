/* Example programs, grouped by the CSC 241 (Fall 2026, Section 403) weekly schedule.
 *
 * To add your own: append an object to the `items` of a group.
 *   id     unique slug (used in ?example=<id> links)
 *   title  shown in the picker
 *   watch  one or two sentences telling students what to look for
 *   expectError (optional) true if the program is *meant* to crash
 *   code   the Python source. Keep it inside String.raw`...` so "\n" stays as
 *          typed. Do not use backticks or a dollar-brace inside the code.
 */
const EXAMPLES = [
  {
    group: "Week 1 · Expressions, Booleans, Data Types, Lists",
    items: [
      {
        id: "expressions",
        title: "Expressions and assignment",
        watch: "Each assignment creates a new variable in the Global frame. Notice that / always gives a float, while // gives an int.",
        code: String.raw`# Expressions and assignment
width = 8
height = 5
area = width * height
perimeter = 2 * (width + height)
half = area / 2
whole = area // 3
remainder = area % 3
print("Area:", area)
print("Half:", half)
`,
      },
      {
        id: "types",
        title: "Data types: int, float, str",
        watch: "Hover a value to see its type. Compare 0.1 + 0.2 with what you expected, and see how + means different things for numbers and strings.",
        code: String.raw`a = 0.1 + 0.2
b = 7 / 2
c = 7 // 2
d = int("42") + 1
e = "42" + "1"
f = "ha" * 3
g = float(3)
h = str(3) + "3"
`,
      },
      {
        id: "strings",
        title: "Strings: indexing and slicing",
        watch: "Strings are immutable: s.upper() makes a NEW string and s is unchanged until you reassign it.",
        code: String.raw`s = "Python"
first = s[0]
last = s[-1]
middle = s[1:4]
n = len(s)
shout = s.upper()
s2 = s + "!"
print(s, s2)
`,
      },
      {
        id: "booleans",
        title: "Boolean expressions",
        watch: "Comparison operators produce True or False. Follow how and, or, not combine them.",
        code: String.raw`age = 20
has_id = True
adult = age >= 18
can_enter = adult and has_id
is_teen = 13 <= age <= 19
not_adult = not adult
either = is_teen or has_id
print(can_enter)
`,
      },
      {
        id: "list-alias",
        title: "Lists: aliasing vs copying",
        watch: "b = a makes a second ARROW to the same list, so appending through b changes what a sees. c = a[:] builds a separate list.",
        code: String.raw`a = [1, 2, 3]
b = a
c = a[:]
b.append(4)
print("a:", a)
print("c:", c)
`,
      },
      {
        id: "list-methods",
        title: "Lists: methods and slicing",
        watch: "Methods like append, insert, pop and sort change the SAME list object. Slices create new lists.",
        code: String.raw`nums = [5, 3, 8]
nums.append(1)
nums.insert(0, 9)
last = nums.pop()
nums.sort()
first_two = nums[:2]
total = sum(nums)
print(nums, first_two, total)
`,
      },
    ],
  },
  {
    group: "Week 2 · Input/Output and Decisions",
    items: [
      {
        id: "input",
        title: "Input and output",
        watch: "input() ALWAYS returns a string. A pop-up will ask you for values. See where int() converts the text into a number.",
        code: String.raw`name = input("Your name? ")
year_text = input("Birth year? ")
year = int(year_text)
age = 2026 - year
print("Hello,", name)
print("You turn", age, "this year")
`,
      },
      {
        id: "if-elif",
        title: "if / elif / else",
        watch: "Only ONE branch runs. Watch the green arrow skip the branches whose conditions are False.",
        code: String.raw`score = 83
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"
print("Grade:", grade)
`,
      },
    ],
  },
  {
    group: "Week 2–3 · Functions",
    items: [
      {
        id: "function-basic",
        title: "Defining and calling a function",
        watch: "def only creates the function object. Each CALL builds a new frame with its own parameters, and the frame disappears after return.",
        code: String.raw`def area(width, height):
    result = width * height
    return result

a1 = area(3, 4)
a2 = area(5, 6)
total = a1 + a2
print(total)
`,
      },
      {
        id: "scope",
        title: "Local vs global variables",
        watch: "The x inside change() is a different variable from the global x. Reassigning the parameter does not touch the caller's variable.",
        code: String.raw`x = 10

def change(x):
    x = x + 5
    print("inside:", x)
    return x

y = change(x)
print("outside:", x, y)
`,
      },
      {
        id: "call-stack",
        title: "Functions calling functions (call stack)",
        watch: "The frames stack up as functions call each other, and unwind in reverse order as each one returns.",
        code: String.raw`def square(n):
    return n * n

def sum_of_squares(a, b):
    sa = square(a)
    sb = square(b)
    return sa + sb

result = sum_of_squares(3, 4)
print(result)
`,
      },
      {
        id: "mutable-args",
        title: "Passing lists to functions",
        watch: "add_item changes the caller's list because both names point at the same object. reassign only rebinds its own local name.",
        code: String.raw`def add_item(items, value):
    items.append(value)

def reassign(items):
    items = [0, 0]

data = [1, 2]
add_item(data, 3)
reassign(data)
print(data)
`,
      },
    ],
  },
  {
    group: "Week 4 · for Loops and Counting",
    items: [
      {
        id: "for-range",
        title: "for loop with range()",
        watch: "The loop variable i is re-assigned on every pass. total accumulates the running sum.",
        code: String.raw`total = 0
for i in range(1, 6):
    total = total + i
print(total)
`,
      },
      {
        id: "for-string",
        title: "Looping over a string",
        watch: "Loop 'by value': ch takes each character in turn, one per iteration.",
        code: String.raw`word = "loop"
count = 0
for ch in word:
    print(ch)
    count += 1
print(count)
`,
      },
      {
        id: "count-evens",
        title: "Counting loop",
        watch: "A counting loop pairs an if-statement with a counter that starts at 0.",
        code: String.raw`nums = [4, 7, 10, 3, 8]
evens = 0
for n in nums:
    if n % 2 == 0:
        evens += 1
print(evens)
`,
      },
    ],
  },
  {
    group: "Week 5 · Loops by Value and Index, Formatted Output, Exceptions",
    items: [
      {
        id: "value-vs-index",
        title: "Loop by value vs by index",
        watch: "Same list, two ways: the first loop hands you each item; the second hands you positions 0, 1, 2 that you use to look items up.",
        code: String.raw`names = ["Ana", "Ben", "Cy"]
for name in names:
    print(name)
for i in range(len(names)):
    print(i, names[i])
`,
      },
      {
        id: "formatted",
        title: "Formatted output",
        watch: "f-strings and format() build a new string; the variables themselves do not change.",
        code: String.raw`item = "Coffee"
price = 3.5
qty = 3
total = price * qty
print(f"{item}: {price:.2f} x {qty} = {total:.2f}")
print("{:<10}{:>8.2f}".format(item, total))
`,
      },
      {
        id: "try-except",
        title: "Exceptions: try / except",
        watch: "Watch the exception step: control jumps straight to the except block, skipping the rest of the try.",
        code: String.raw`def safe_divide(a, b):
    try:
        result = a / b
    except ZeroDivisionError:
        result = None
    return result

x = safe_divide(10, 2)
y = safe_divide(5, 0)
print(x, y)
`,
      },
      {
        id: "debug-index",
        title: "Debugging: an off-by-one crash",
        expectError: true,
        watch: "Step until the red exception box. Why is the index too big on the last pass? Compare <= with <.",
        code: String.raw`nums = [1, 2, 3]
i = 0
while i <= len(nums):
    print(nums[i])
    i += 1
`,
      },
    ],
  },
  {
    group: "Week 6–7 · File Handling, while Loops, Loop Patterns",
    items: [
      {
        id: "files",
        title: "Writing and reading a file",
        watch: "The file is created in a virtual in-browser disk. See how each line of text is split and converted before it is added to the total.",
        code: String.raw`with open("scores.txt", "w") as f:
    f.write("Ana 90\n")
    f.write("Ben 85\n")

total = 0
with open("scores.txt") as f:
    for line in f:
        parts = line.split()
        total += int(parts[1])
print(total)
`,
      },
      {
        id: "while-sentinel",
        title: "while loop with a sentinel",
        watch: "The loop stops when the sentinel value -1 is reached. i, total and count change together on each pass.",
        code: String.raw`data = [5, 8, 2, -1, 7]
total = 0
count = 0
i = 0
while data[i] != -1:
    total += data[i]
    count += 1
    i += 1
average = total / count
print(average)
`,
      },
      {
        id: "accumulate-list",
        title: "Accumulator pattern: building a list",
        watch: "The list object grows in place: the same box on the right gets one more cell on every pass.",
        code: String.raw`squares = []
for n in range(1, 6):
    squares.append(n * n)
print(squares)
`,
      },
      {
        id: "find-max",
        title: "Indexed loop: find the maximum",
        watch: "Two variables travel together: best (the value) and best_i (its index). Update both inside the if.",
        code: String.raw`scores = [72, 95, 88, 95, 60]
best = scores[0]
best_i = 0
for i in range(1, len(scores)):
    if scores[i] > best:
        best = scores[i]
        best_i = i
print(best, best_i)
`,
      },
    ],
  },
  {
    group: "Week 8 · Nested Loops and 2D Lists",
    items: [
      {
        id: "nested",
        title: "Nested loops: multiplication table",
        watch: "For every ONE pass of the outer loop, the inner loop runs completely. line is rebuilt for each row.",
        code: String.raw`for row in range(1, 4):
    line = ""
    for col in range(1, 4):
        line = line + str(row * col) + " "
    print(line)
`,
      },
      {
        id: "grid",
        title: "2D lists: summing a grid",
        watch: "A 2D list is a list of lists: the outer list has arrows to three inner lists. grid[1] is the middle row object.",
        code: String.raw`grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
total = 0
for r in range(len(grid)):
    for c in range(len(grid[r])):
        total += grid[r][c]
row_copy = grid[1]
print(total)
`,
      },
      {
        id: "grid-trap",
        title: "2D list trap: [[0]*3]*3",
        watch: "bad has THREE arrows to the SAME row, so one assignment shows up in every row. good builds three separate rows.",
        code: String.raw`bad = [[0] * 3] * 3
bad[0][0] = 9
good = [[0] * 3 for _ in range(3)]
good[0][0] = 9
print(bad)
print(good)
`,
      },
    ],
  },
  {
    group: "Weeks 8–9 · Dictionaries, Tuples, Sets, Random",
    items: [
      {
        id: "dict-basic",
        title: "Dictionaries: add, update, delete",
        watch: "Keys map to values. Assigning to a NEW key adds a row; assigning to an existing key replaces its value.",
        code: String.raw`ages = {"Ana": 20, "Ben": 22}
ages["Cy"] = 19
ages["Ana"] = 21
for name in ages:
    print(name, ages[name])
del ages["Ben"]
print(ages)
`,
      },
      {
        id: "dict-count",
        title: "Dictionaries: counting words",
        watch: "A classic counting pattern: if the key exists, add 1; otherwise create it with the value 1.",
        code: String.raw`text = "to be or not to be"
counts = {}
for w in text.split():
    if w in counts:
        counts[w] += 1
    else:
        counts[w] = 1
print(counts)
`,
      },
      {
        id: "tuples",
        title: "Tuples: unpacking and immutability",
        watch: "Unpacking assigns several names at once. Assigning into a tuple raises a TypeError, which we catch.",
        code: String.raw`point = (3, 4)
x, y = point
dist = (x ** 2 + y ** 2) ** 0.5
a, b = 1, 2
a, b = b, a
try:
    point[0] = 9
except TypeError:
    msg = "tuples cannot change"
print(dist, a, b, msg)
`,
      },
      {
        id: "sets",
        title: "Sets: unique values and operations",
        watch: "set() removes duplicates. & keeps what both sets share, | combines them.",
        code: String.raw`raw = [3, 1, 3, 2, 1]
unique = set(raw)
unique.add(5)
a = {1, 2, 3}
b = {2, 3, 4}
both = a & b
either = a | b
print(unique, both, either)
`,
      },
      {
        id: "random",
        title: "Random module",
        watch: "random.seed(7) makes the 'random' rolls repeatable, which is handy for testing programs.",
        code: String.raw`import random
random.seed(7)
rolls = []
for i in range(5):
    rolls.append(random.randint(1, 6))
print(rolls)
`,
      },
    ],
  },
  {
    group: "Bonus",
    items: [
      {
        id: "recursion",
        title: "Bonus: recursion (factorial)",
        watch: "Not on the syllabus, but it shows the call stack beautifully: four frames of the same function, each waiting for the one above it.",
        code: String.raw`def fact(n):
    if n == 0:
        return 1
    return n * fact(n - 1)

print(fact(4))
`,
      },
    ],
  },
];
