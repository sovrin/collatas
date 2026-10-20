// collatas' part of the nexitas shell: its name and icon, its panel on each project, and its
// section in the nav.
export default defineAppConfig({
  nexitas: {
    modules: [
      {
        id: 'collatas',
        label: 'Feedback',
        description: 'A feedback form for your sites, and one inbox for all of it.',
        icon: 'chat-dots',
        panel: 'CollatasProject',
      },
    ],
    nav: [{ to: '/feedback', label: 'Inbox', module: 'collatas' }],
  },
})
