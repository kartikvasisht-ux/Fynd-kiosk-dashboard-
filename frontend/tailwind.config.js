export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101828",
        muted: "#667085",
        line: "#dce3ec",
        surface: "#f6f8fb",
        brand: "#3157e8"
      },
      boxShadow: {
        soft: "0 14px 34px rgba(15, 23, 42, 0.08)",
        card: "0 8px 24px rgba(16, 24, 40, 0.05)"
      }
    }
  },
  plugins: []
};
