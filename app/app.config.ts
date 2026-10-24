// collatas' part of the nexitas shell: its name and icon, its panel on each project, and its
// section in the nav.
export default defineAppConfig({
  nexitas: {
    modules: [
      {
        id: 'collatas',
        label: 'Feedback',
        description: 'A feedback form for your sites, and an inbox for what it collects.',
        icon: 'chat-dots',
        accent: 'orange',
        panel: 'CollatasProject',
      },
    ],
    nav: [{ to: '/feedback', label: 'Feedback', module: 'collatas' }],
  },
})
