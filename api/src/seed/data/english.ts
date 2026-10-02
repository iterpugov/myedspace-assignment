import type { CourseSeed } from './course-seed';

export const english: CourseSeed = {
  subject: 'English',
  yearFrom: 5,
  yearTo: 13,
  pricePence: 19900,
  lessons: [
    {
      title: 'Reading for meaning',
      summary: 'Finding what a text says and what it only suggests.',
      body: [
        'Some information is stated directly: the writer simply tells us. Other information is implied, and the reader has to work it out from the clues in the text.',
        'When answering a question about a text, point to the words that support the answer. A short quotation followed by an explanation is stronger than an opinion alone.',
        'Try it: choose a paragraph from a book you are reading and write one thing it states and one thing it suggests.',
      ].join('\n\n'),
    },
    {
      title: 'Building a paragraph',
      summary: 'A point, the evidence for it and an explanation.',
      body: [
        'A clear paragraph makes one point. Start with a sentence that says what the point is, so the reader knows where the paragraph is going.',
        'Follow the point with evidence, such as a quotation or an example, and then explain how the evidence supports the point.',
        'Try it: write a paragraph arguing that a character you know is brave, using one quotation.',
      ].join('\n\n'),
    },
    {
      title: 'Persuasive writing',
      summary: 'Techniques that make a reader agree.',
      body: [
        'Persuasive writing tries to change what the reader thinks or does. Writers address the reader directly, ask questions that need no answer and group ideas in threes.',
        'Facts and examples make an argument harder to dismiss, and answering the obvious objection shows that the writer has thought about the other side.',
        'Try it: write five sentences persuading your school to start lessons one hour later.',
      ].join('\n\n'),
    },
  ],
};
