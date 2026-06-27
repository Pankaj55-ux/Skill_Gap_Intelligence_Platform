/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {
    colors: { ink: "#0b1220", brand: { 50: "#eef6ff", 500: "#2563eb", 600: "#1d4ed8", 900: "#172554" } },
    boxShadow: { card: "0 8px 30px rgba(15,23,42,.07)" }
  }},
  plugins: []
};
