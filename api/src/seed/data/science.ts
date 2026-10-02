import type { CourseSeed } from './course-seed';

export const science: CourseSeed = {
  subject: 'Science',
  yearFrom: 5,
  yearTo: 11,
  pricePence: 19900,
  lessons: [
    {
      title: 'States of matter',
      summary: 'How particles are arranged in solids, liquids and gases.',
      body: [
        'Everything is made of particles. In a solid they are packed closely in a fixed pattern and can only vibrate, which is why a solid keeps its shape.',
        'In a liquid the particles are still close together but can move past each other, so a liquid flows. In a gas they are far apart and move quickly in every direction.',
        'Try it: explain, using particles, why a gas can be squashed into a smaller space but a solid cannot.',
      ].join('\n\n'),
    },
    {
      title: 'Forces and motion',
      summary: 'What happens when forces are balanced and when they are not.',
      body: [
        'A force is a push or a pull, measured in newtons. When the forces on an object are balanced it stays still or keeps moving at a steady speed.',
        'When the forces are unbalanced the object speeds up, slows down or changes direction. The bigger the resultant force, the bigger the change.',
        'Try it: draw the forces on a cyclist travelling at a steady speed and say what you know about their sizes.',
      ].join('\n\n'),
    },
    {
      title: 'Cells',
      summary: 'The building blocks of living things.',
      body: [
        'All living things are made of cells. Animal and plant cells both have a nucleus, cytoplasm and a cell membrane.',
        'Plant cells also have a cell wall for support, chloroplasts for photosynthesis and a large vacuole filled with cell sap.',
        'Try it: list two differences between an animal cell and a plant cell and say what each extra part does.',
      ].join('\n\n'),
    },
  ],
};
