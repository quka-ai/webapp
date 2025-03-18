import {heroui} from "@heroui/react"

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    './src/layouts/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
  	extend: {
  		screens: {
  			xl: '1540px',
  			'2xl': '1860px'
  		},
		animation: {
			"shiny-text": "shiny-text 8s infinite",
			shine: "shine var(--duration) infinite linear",
			"background-position-spin": "background-position-spin 3000ms infinite alternate",
			marquee: "marquee var(--duration) linear infinite",
	        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
		},
		keyframes: {
			"shiny-text": {
				"0%, 90%, 100%": {
					"background-position": "calc(-100% - var(--shiny-width)) 0",
				},
				"30%, 60%": {
					"background-position": "calc(100% + var(--shiny-width)) 0",
				}
			},
			shine: {
				"0%": {
					"background-position": "0% 0%",
				},
				"50%": {
					"background-position": "100% 100%",
				},
				to: {
					"background-position": "0% 0%",
				}
			},
			"background-position-spin": {
				"0%": { backgroundPosition: "top center" },
				"100%": { backgroundPosition: "bottom center" }
			},
			marquee: {
				from: { transform: "translateX(0)" },
				to: { transform: "translateX(calc(-100% - var(--gap)))" },
			},
			"marquee-vertical": {
				from: { transform: "translateY(0)" },
				to: { transform: "translateY(calc(-100% - var(--gap)))" },
			}
		}
  		// borderRadius: {
  		// 	lg: 'var(--radius)',
  		// 	md: 'calc(var(--radius) - 2px)',
  		// 	sm: 'calc(var(--radius) - 4px)'
  		// },
  		// colors: {
  		// 	background: 'hsl(var(--background))',
  		// 	foreground: 'hsl(var(--foreground))',
  		// 	card: {
  		// 		DEFAULT: 'hsl(var(--card))',
  		// 		foreground: 'hsl(var(--card-foreground))'
  		// 	},
  		// 	popover: {
  		// 		DEFAULT: 'hsl(var(--popover))',
  		// 		foreground: 'hsl(var(--popover-foreground))'
  		// 	},
  		// 	primary: {
  		// 		DEFAULT: 'hsl(var(--primary))',
  		// 		foreground: 'hsl(var(--primary-foreground))'
  		// 	},
  		// 	secondary: {
  		// 		DEFAULT: 'hsl(var(--secondary))',
  		// 		foreground: 'hsl(var(--secondary-foreground))'
  		// 	},
  		// 	muted: {
  		// 		DEFAULT: 'hsl(var(--muted))',
  		// 		foreground: 'hsl(var(--muted-foreground))'
  		// 	},
  		// 	accent: {
  		// 		DEFAULT: 'hsl(var(--accent))',
  		// 		foreground: 'hsl(var(--accent-foreground))'
  		// 	},
  		// 	destructive: {
  		// 		DEFAULT: 'hsl(var(--destructive))',
  		// 		foreground: 'hsl(var(--destructive-foreground))'
  		// 	},
  		// 	border: 'hsl(var(--border))',
  		// 	input: 'hsl(var(--input))',
  		// 	ring: 'hsl(var(--ring))',
  		// 	chart: {
  		// 		'1': 'hsl(var(--chart-1))',
  		// 		'2': 'hsl(var(--chart-2))',
  		// 		'3': 'hsl(var(--chart-3))',
  		// 		'4': 'hsl(var(--chart-4))',
  		// 		'5': 'hsl(var(--chart-5))'
  		// 	}
  		// }
  	}
  },
  darkMode: "class",
 plugins: [heroui(), require("tailwindcss-animate")],
}
