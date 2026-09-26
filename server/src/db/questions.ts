/**
 * The 100-question IELTS Speaking bank.
 * 10 topic sets × (3 Part-1 + 3 Part-2 cue cards + 4 Part-3) = 100 items.
 * Seeded by db/seed.ts; re-edit here and re-run `npm run db:seed`.
 */

export interface SeedPart2 {
  prompt: string;
  leadIn: string;
  bullets: string[];
}

export interface SeedQuestionSet {
  slug: string;
  title: string;
  part1: { prompt: string }[];
  part2: SeedPart2[];
  part3: { prompt: string }[];
}

export const QUESTION_SETS: SeedQuestionSet[] = [
  {
    slug: 'hometown',
    title: 'Hometown',
    part1: [
      { prompt: 'Where do you live now? Do you live in a house or a flat?' },
      { prompt: 'What do you like most about your hometown?' },
      { prompt: 'How often do you visit the places where you grew up?' },
    ],
    part2: [
      {
        prompt: 'Describe a place in your hometown you like to visit',
        leadIn: 'You should say:',
        bullets: [
          'where it is',
          'how often you go there',
          'who you usually go with',
          'and explain why you like visiting it',
        ],
      },
      {
        prompt: 'Describe a building in your hometown that is important to you',
        leadIn: 'You should say:',
        bullets: [
          'what the building is',
          'where it is located',
          'what it is used for',
          'and explain why it is important to you',
        ],
      },
      {
        prompt: 'Describe a quiet place in your hometown',
        leadIn: 'You should say:',
        bullets: [
          'where it is',
          'when you usually go there',
          'what you do there',
          'and explain why you find it peaceful',
        ],
      },
    ],
    part3: [
      { prompt: 'Why do some people prefer to live in big cities?' },
      { prompt: 'What makes a hometown attractive to visitors?' },
      { prompt: 'How can small towns keep young people from moving away?' },
      { prompt: 'Do you think cities will change a lot in the next fifty years?' },
    ],
  },
  {
    slug: 'work-study',
    title: 'Work & Study',
    part1: [
      { prompt: 'Do you work, or are you a student?' },
      { prompt: 'What do you like most about your work or studies?' },
      { prompt: 'Is there anything you would like to change about it?' },
    ],
    part2: [
      {
        prompt: 'Describe a job you would like to do in the future',
        leadIn: 'You should say:',
        bullets: [
          'what the job is',
          'what skills it requires',
          'why you want to do it',
          'and explain how you would get this job',
        ],
      },
      {
        prompt: 'Describe a useful skill you learned at work or school',
        leadIn: 'You should say:',
        bullets: [
          'what the skill is',
          'when you learned it',
          'how you learned it',
          'and explain why it has been useful to you',
        ],
      },
      {
        prompt: 'Describe a person who works very hard',
        leadIn: 'You should say:',
        bullets: [
          'who this person is',
          'what they do',
          'how you know them',
          'and explain why you admire them',
        ],
      },
    ],
    part3: [
      { prompt: 'How will artificial intelligence change the job market?' },
      { prompt: 'Is it better to study alone or with other people?' },
      { prompt: 'What qualities make someone a good employee?' },
      { prompt: 'Do you think people should change jobs often?' },
    ],
  },
  {
    slug: 'home-accommodation',
    title: 'Home & Accommodation',
    part1: [
      { prompt: 'Do you live in a house or a flat?' },
      { prompt: 'Who do you live with?' },
      { prompt: "What is your favourite room in your home?" },
    ],
    part2: [
      {
        prompt: 'Describe your dream home',
        leadIn: 'You should say:',
        bullets: [
          'where it would be',
          'what it would look like',
          'what rooms it would have',
          'and explain why you would love to live there',
        ],
      },
      {
        prompt: 'Describe a room where you spend a lot of time',
        leadIn: 'You should say:',
        bullets: [
          'which room it is',
          'what is in it',
          'what you usually do there',
          'and explain why you like this room',
        ],
      },
      {
        prompt: 'Describe a place you lived in that you liked',
        leadIn: 'You should say:',
        bullets: [
          'where it was',
          'when you lived there',
          'who you lived with',
          'and explain why you liked living there',
        ],
      },
    ],
    part3: [
      { prompt: 'What makes a house feel like a home?' },
      { prompt: 'How has home design changed in recent decades?' },
      { prompt: 'Do you think it is better to rent or to own a home?' },
      { prompt: 'How might people’s homes change in the future?' },
    ],
  },
  {
    slug: 'hobbies-interests',
    title: 'Hobbies & Interests',
    part1: [
      { prompt: 'What do you usually do in your free time?' },
      { prompt: 'Did you have any hobbies when you were a child?' },
      { prompt: 'Do you prefer indoor or outdoor activities?' },
    ],
    part2: [
      {
        prompt: 'Describe a hobby you enjoy spending time on',
        leadIn: 'You should say:',
        bullets: [
          'what the hobby is',
          'when you started it',
          'how often you do it',
          'and explain why you enjoy it',
        ],
      },
      {
        prompt: 'Describe a sport or physical activity you like',
        leadIn: 'You should say:',
        bullets: [
          'what it is',
          'who you do it with',
          'when you do it',
          'and explain why you like it',
        ],
      },
      {
        prompt: 'Describe a creative activity you enjoy',
        leadIn: 'You should say:',
        bullets: [
          'what the activity is',
          'how you do it',
          'where you usually do it',
          'and explain why you find it enjoyable',
        ],
      },
    ],
    part3: [
      { prompt: 'Why are hobbies important for people’s lives?' },
      { prompt: 'How can busy people find time for hobbies?' },
      { prompt: 'Should schools spend more time on hobbies and sports?' },
      { prompt: 'Do you think people’s hobbies will change in the future?' },
    ],
  },
  {
    slug: 'weather-seasons',
    title: 'Weather & Seasons',
    part1: [
      { prompt: 'What is the weather like where you live?' },
      { prompt: 'Which season do you like best?' },
      { prompt: 'Do you usually check the weather forecast?' },
    ],
    part2: [
      {
        prompt: 'Describe a day when the weather was unusually good',
        leadIn: 'You should say:',
        bullets: [
          'when it was',
          'where you were',
          'what you did that day',
          'and explain how you felt about it',
        ],
      },
      {
        prompt: 'Describe a season you enjoy',
        leadIn: 'You should say:',
        bullets: [
          'which season it is',
          'what the weather is usually like',
          'what you usually do in that season',
          'and explain why you enjoy it',
        ],
      },
      {
        prompt: 'Describe a time when bad weather affected you',
        leadIn: 'You should say:',
        bullets: [
          'when it happened',
          'where you were',
          'what happened because of the weather',
          'and explain how you felt',
        ],
      },
    ],
    part3: [
      { prompt: 'How does the weather affect people’s mood?' },
      { prompt: 'Has climate change changed the weather where you live?' },
      { prompt: 'Should governments do more to fight climate change?' },
      { prompt: 'How do people in different countries deal with extreme weather?' },
    ],
  },
  {
    slug: 'food-cooking',
    title: 'Food & Cooking',
    part1: [
      { prompt: 'Do you like cooking?' },
      { prompt: 'What is your favourite food?' },
      { prompt: 'How often do you eat at restaurants?' },
    ],
    part2: [
      {
        prompt: 'Describe a meal you really enjoyed',
        leadIn: 'You should say:',
        bullets: [
          'what the meal was',
          'where you ate it',
          'who you were with',
          'and explain why you enjoyed it so much',
        ],
      },
      {
        prompt: 'Describe a dish you can cook',
        leadIn: 'You should say:',
        bullets: [
          'what the dish is',
          'how you learned to cook it',
          'how you prepare it',
          'and explain why you like making it',
        ],
      },
      {
        prompt: 'Describe a restaurant or café you like',
        leadIn: 'You should say:',
        bullets: [
          'where it is',
          'what it looks like',
          'what food or drinks they serve',
          'and explain why you like going there',
        ],
      },
    ],
    part3: [
      { prompt: 'Is home-cooked food healthier than restaurant food?' },
      { prompt: 'How has the way people eat changed in your country?' },
      { prompt: 'Why do some people enjoy trying food from other cultures?' },
      { prompt: 'What role will technology play in food and cooking?' },
    ],
  },
  {
    slug: 'travel-transport',
    title: 'Travel & Transport',
    part1: [
      { prompt: 'Do you like travelling?' },
      { prompt: 'How do you usually get around your city?' },
      { prompt: 'Have you ever been on a very long journey?' },
    ],
    part2: [
      {
        prompt: 'Describe a place you would like to visit',
        leadIn: 'You should say:',
        bullets: [
          'where the place is',
          'how you would get there',
          'who you would go with',
          'and explain why you want to visit it',
        ],
      },
      {
        prompt: 'Describe a memorable journey you made',
        leadIn: 'You should say:',
        bullets: [
          'when it was',
          'where you went',
          'who you travelled with',
          'and explain why you remember it well',
        ],
      },
      {
        prompt: 'Describe a type of transport you use often',
        leadIn: 'You should say:',
        bullets: [
          'what it is',
          'where you use it',
          'when you use it',
          'and explain what you like about it',
        ],
      },
    ],
    part3: [
      { prompt: 'Do you think people will travel less in the future?' },
      { prompt: 'How can cities reduce traffic congestion?' },
      { prompt: 'Is tourism always good for a place?' },
      { prompt: 'Should long-haul flights be taxed more heavily?' },
    ],
  },
  {
    slug: 'technology-internet',
    title: 'Technology & Internet',
    part1: [
      { prompt: 'What devices do you use every day?' },
      { prompt: 'How often do you go online?' },
      { prompt: 'Do you think you use technology too much?' },
    ],
    part2: [
      {
        prompt: 'Describe a piece of technology you find useful',
        leadIn: 'You should say:',
        bullets: [
          'what it is',
          'when you got it',
          'how you use it',
          'and explain why you find it useful',
        ],
      },
      {
        prompt: 'Describe an app you use often',
        leadIn: 'You should say:',
        bullets: [
          'what the app is',
          'what it does',
          'how often you use it',
          'and explain why you like it',
        ],
      },
      {
        prompt: 'Describe a time when technology helped you solve a problem',
        leadIn: 'You should say:',
        bullets: [
          'what the problem was',
          'what technology you used',
          'how it helped you',
          'and explain how you felt afterwards',
        ],
      },
    ],
    part3: [
      { prompt: 'How has the internet changed education?' },
      { prompt: 'What problems can social media cause?' },
      { prompt: 'Will robots take many jobs away from humans?' },
      { prompt: 'How can older people benefit from technology?' },
    ],
  },
  {
    slug: 'family-friends',
    title: 'Family & Friends',
    part1: [
      { prompt: 'Do you have a big family?' },
      { prompt: 'Do you prefer spending time with family or with friends?' },
      { prompt: 'How often do you see your friends?' },
    ],
    part2: [
      {
        prompt: 'Describe a family member you are close to',
        leadIn: 'You should say:',
        bullets: [
          'who this person is',
          'what they are like',
          'what you usually do together',
          'and explain why you are close to them',
        ],
      },
      {
        prompt: 'Describe a friend you have known for a long time',
        leadIn: 'You should say:',
        bullets: [
          'who this friend is',
          'how you met',
          'what you usually do together',
          'and explain why this friend is important to you',
        ],
      },
      {
        prompt: 'Describe a happy family event you remember well',
        leadIn: 'You should say:',
        bullets: [
          'what the event was',
          'when it happened',
          'who was there',
          'and explain why you remember it so well',
        ],
      },
    ],
    part3: [
      { prompt: 'How has family life changed in recent decades?' },
      { prompt: 'Is it easier to make friends now than it was in the past?' },
      { prompt: 'What qualities make someone a good friend?' },
      { prompt: 'Will families live closer together in the future?' },
    ],
  },
  {
    slug: 'shopping-entertainment',
    title: 'Shopping & Entertainment',
    part1: [
      { prompt: 'Do you prefer shopping in stores or online?' },
      { prompt: 'How often do you go to the cinema?' },
      { prompt: 'Do you like buying new things?' },
    ],
    part2: [
      {
        prompt: 'Describe something you bought recently',
        leadIn: 'You should say:',
        bullets: [
          'what you bought',
          'where you bought it',
          'why you bought it',
          'and explain how you felt about the purchase',
        ],
      },
      {
        prompt: 'Describe a film or TV show you enjoyed',
        leadIn: 'You should say:',
        bullets: [
          'what it is about',
          'when you watched it',
          'who you watched it with',
          'and explain why you enjoyed it',
        ],
      },
      {
        prompt: 'Describe a song or piece of music you like',
        leadIn: 'You should say:',
        bullets: [
          'what the song is',
          'when you first heard it',
          'where you usually hear it',
          'and explain why you like it',
        ],
      },
    ],
    part3: [
      { prompt: 'How will people shop in the future?' },
      { prompt: 'Is spending too much money a problem for many people?' },
      { prompt: 'How has streaming changed the entertainment industry?' },
      { prompt: 'Do you think cinemas will disappear one day?' },
    ],
  },
];
