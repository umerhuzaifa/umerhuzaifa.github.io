import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
import tkinter as tk
from tkinter import ttk
from scipy import signal


class SystemIdentificationGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Second-Order System Identification")
        self.root.geometry("1000x700")
        
        # Generate the "unknown" system (target system to identify)
        # You can change these parameters to create different unknown systems
        self.unknown_zeta = 0.4  # Damping ratio
        self.unknown_wn = 5.0    # Undamped natural frequency (rad/s)
        
        # Time vector for simulation
        self.t = np.linspace(0, 5, 1000)
        
        # Calculate unknown system response
        self.unknown_response = self.calculate_step_response(
            self.unknown_zeta, self.unknown_wn, self.t
        )
        
        # Create the GUI components
        self.create_widgets()
        
        # Initial plot
        self.update_plot()
    
    def calculate_step_response(self, zeta, wn, t):
        """
        Calculate step response of a second-order system.
        Transfer function: G(s) = wn^2 / (s^2 + 2*zeta*wn*s + wn^2)
        """
        # Create the transfer function
        num = [wn**2]
        den = [1, 2*zeta*wn, wn**2]
        system = signal.TransferFunction(num, den)
        
        # Calculate step response
        t_out, y_out = signal.step(system, T=t)
        
        return y_out
    
    def create_widgets(self):
        # Create main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(0, weight=1)
        
        # Create matplotlib figure
        self.fig = Figure(figsize=(10, 6), dpi=100)
        self.ax = self.fig.add_subplot(111)
        
        # Create canvas
        self.canvas = FigureCanvasTkAgg(self.fig, master=main_frame)
        self.canvas.get_tk_widget().grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Create control frame
        control_frame = ttk.Frame(main_frame, padding="10")
        control_frame.grid(row=1, column=0, sticky=(tk.W, tk.E))
        
        # Damping ratio slider
        ttk.Label(control_frame, text="Damping Ratio (ζ):", font=('Arial', 10, 'bold')).grid(
            row=0, column=0, sticky=tk.W, padx=5, pady=5
        )
        
        self.zeta_var = tk.DoubleVar(value=0.7)
        self.zeta_slider = ttk.Scale(
            control_frame, from_=0.01, to=2.0, orient=tk.HORIZONTAL,
            variable=self.zeta_var, command=self.on_slider_change, length=300
        )
        self.zeta_slider.grid(row=0, column=1, padx=5, pady=5)
        
        self.zeta_label = ttk.Label(control_frame, text=f"{self.zeta_var.get():.3f}")
        self.zeta_label.grid(row=0, column=2, padx=5, pady=5)
        
        # Undamped natural frequency slider
        ttk.Label(control_frame, text="Undamped Frequency (ωn) [rad/s]:", 
                  font=('Arial', 10, 'bold')).grid(
            row=1, column=0, sticky=tk.W, padx=5, pady=5
        )
        
        self.wn_var = tk.DoubleVar(value=3.0)
        self.wn_slider = ttk.Scale(
            control_frame, from_=0.5, to=15.0, orient=tk.HORIZONTAL,
            variable=self.wn_var, command=self.on_slider_change, length=300
        )
        self.wn_slider.grid(row=1, column=1, padx=5, pady=5)
        
        self.wn_label = ttk.Label(control_frame, text=f"{self.wn_var.get():.3f}")
        self.wn_label.grid(row=1, column=2, padx=5, pady=5)
        
        # Info label
        info_text = f"Target System: ζ = {self.unknown_zeta:.3f}, ωn = {self.unknown_wn:.3f} rad/s"
        ttk.Label(control_frame, text=info_text, font=('Arial', 10), 
                  foreground='red').grid(row=2, column=0, columnspan=3, pady=10)
        
        # Error label
        self.error_label = ttk.Label(control_frame, text="", font=('Arial', 9))
        self.error_label.grid(row=3, column=0, columnspan=3, pady=5)
    
    def on_slider_change(self, event=None):
        """Called when slider values change"""
        # Update labels
        self.zeta_label.config(text=f"{self.zeta_var.get():.3f}")
        self.wn_label.config(text=f"{self.wn_var.get():.3f}")
        
        # Update plot
        self.update_plot()
    
    def update_plot(self):
        """Update the plot with current slider values"""
        # Get current slider values
        current_zeta = self.zeta_var.get()
        current_wn = self.wn_var.get()
        
        # Calculate current system response
        current_response = self.calculate_step_response(current_zeta, current_wn, self.t)
        
        # Calculate error (Mean Squared Error)
        mse = np.mean((self.unknown_response - current_response)**2)
        
        # Clear and redraw
        self.ax.clear()
        
        # Plot unknown system (red)
        self.ax.plot(self.t, self.unknown_response, 'r-', linewidth=2, 
                     label='Unknown System (Target)', alpha=0.8)
        
        # Plot current system (blue)
        self.ax.plot(self.t, current_response, 'b--', linewidth=2, 
                     label=f'Current System (ζ={current_zeta:.3f}, ωn={current_wn:.3f})')
        
        # Formatting
        self.ax.set_xlabel('Time (s)', fontsize=12)
        self.ax.set_ylabel('Response', fontsize=12)
        self.ax.set_title('Second-Order System Step Response', fontsize=14, fontweight='bold')
        self.ax.grid(True, alpha=0.3)
        self.ax.legend(loc='best', fontsize=10)
        self.ax.set_xlim([0, 5])
        
        # Update canvas
        self.canvas.draw()
        
        # Update error label
        self.error_label.config(
            text=f"Mean Squared Error: {mse:.6f}",
            foreground='green' if mse < 0.01 else 'orange' if mse < 0.1 else 'red'
        )


def main():
    root = tk.Tk()
    app = SystemIdentificationGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()