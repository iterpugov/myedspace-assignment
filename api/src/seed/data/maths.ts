import type { CourseSeed } from './course-seed';

export const maths: CourseSeed = {
  subject: 'Maths',
  yearFrom: 5,
  yearTo: 13,
  pricePence: 19900,
  lessons: [
    {
      title: 'Fractions as parts of a whole',
      summary: 'What the top and bottom numbers of a fraction mean.',
      body: [
        'A fraction describes equal parts of a whole. The bottom number, the denominator, says how many equal parts the whole is cut into. The top number, the numerator, says how many of those parts we have.',
        'Two fractions can look different and still be equal: one half is the same amount as two quarters. Multiplying the top and the bottom by the same number never changes the value.',
        'Try it: write three fractions equal to one third, then check each by dividing the top and the bottom by the same number.',
      ].join('\n\n'),
    },
    {
      title: 'Adding and subtracting fractions',
      summary: 'Why the denominators have to match first.',
      body: [
        'Parts can only be added when they are the same size. Before adding one half and one third, rewrite both with the same denominator: three sixths and two sixths.',
        'Once the denominators match, add or subtract the numerators and keep the denominator. Three sixths plus two sixths is five sixths.',
        'Try it: work out three quarters minus one third, and simplify the answer if you can.',
      ].join('\n\n'),
    },
    {
      title: 'Ratio and proportion',
      summary: 'Comparing quantities and scaling them up or down.',
      body: [
        'A ratio compares two quantities. Two parts water to one part squash is written 2 : 1, and it stays the same ratio however much drink is made.',
        'To scale a ratio, multiply every part by the same number. For six cups of water at 2 : 1, three cups of squash are needed.',
        'Try it: a recipe for four people uses 300 g of flour. How much is needed for ten people?',
      ].join('\n\n'),
    },
  ],
};
