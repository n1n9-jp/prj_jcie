tailwind.config = {
	theme: {
		extend: {
			typography: {
				DEFAULT: {
					css: {
						h1: {
							fontSize: '2.5rem',
							fontWeight: '700',
							'@media (max-width: 768px)': {
								fontSize: '2rem',
							},
						},
						h2: {
							fontSize: '2rem',
							fontWeight: '700',
							'@media (max-width: 768px)': {
								fontSize: '1.75rem',
							},
						},
						h3: {
							fontSize: '1.75rem',
							fontWeight: '700',
							'@media (max-width: 768px)': {
								fontSize: '1.5rem',
							},
						},
						h4: {
							fontSize: '1.5rem',
							fontWeight: '700',
							'@media (max-width: 768px)': {
								fontSize: '1.25rem',
							},
						},
						h5: {
							fontSize: '1.25rem',
							fontWeight: '700',
							'@media (max-width: 768px)': {
								fontSize: '1.125rem',
							},
						},
						h6: {
							fontSize: '1.125rem',
							fontWeight: '700',
							'@media (max-width: 768px)': {
								fontSize: '1rem',
							},
						},
					},
				},
			},
		},
	},
} 