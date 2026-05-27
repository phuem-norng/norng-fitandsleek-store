/** @type {import('tailwindcss').Config} */
export default {
	/**
	 * Admin dashboard only: require `html.admin-dashboard` + `data-admin-theme="dark"`.
	 * So storefront (no `admin-dashboard` on `<html>`) never applies `dark:` utilities, even if the
	 * data attribute were left set by mistake.
	 */
	darkMode: ["selector", 'html.admin-dashboard[data-admin-theme="dark"] &'],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    /* Full scale + line-height: consistent rhythm (16px base, common SaaS / editorial pattern) */
    fontSize: {
      xs: ["0.75rem", { lineHeight: "1rem" }],
      sm: ["0.875rem", { lineHeight: "1.25rem" }],
      base: ["1rem", { lineHeight: "1.5rem" }],
      lg: ["1.125rem", { lineHeight: "1.75rem" }],
      xl: ["1.25rem", { lineHeight: "1.75rem" }],
      "2xl": ["1.5rem", { lineHeight: "2rem" }],
      "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
      "5xl": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
      "6xl": ["3.75rem", { lineHeight: "1.08", letterSpacing: "-0.03em" }],
      "7xl": ["4.5rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      "8xl": ["6rem", { lineHeight: "1", letterSpacing: "-0.035em" }],
      "9xl": ["8rem", { lineHeight: "1", letterSpacing: "-0.035em" }],
    },
  	extend: {
			fontFamily: {
				sans: ["Inter", "Kantumruy Pro", "Noto Sans Khmer", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        khmer: ["Kantumruy Pro", "Noto Sans Khmer", "Battambang", "sans-serif"],
			},
			
  		boxShadow: {
  			soft: '0 10px 30px rgba(0,0,0,.08)'
  		},
  		borderRadius: {
  			xl2: '1.25rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
			brand: {
					primary: "#FF8A00",
					background: "#F9F9F9",
					card: "#FFFFFF",
					hoverWarm: "#FFF5EE",
				},
        "brand-primary": "#f39c12",
        "brand-bg": "#f8f9fa",
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
