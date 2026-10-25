// collatas' part of the nexitas shell: its name, icon and hue, and its section in the nav. It is
// set up on its own first page (the inbox's Setup), not on the project's overview.
export default defineAppConfig({
  nexitas: {
    modules: [
      {
        id: 'collatas',
        label: 'Feedback',
        description: 'A feedback form for your sites, and an inbox for what it collects.',
        icon: 'chat-dots',
        accent: 'orange',
      },
    ],
    nav: [{ to: '/feedback', label: 'Feedback', module: 'collatas' }],
  },
})
