/**
 * Loop Troop quest catalog. Checks run on the server after the camper's code,
 * so they can reference the variables and functions the camper created.
 */

export const tracks = [
  {
    id: "basecamp",
    name: "Brightwood Basecamp",
    emoji: "🏕️",
    blurb: "Make the computer talk. Variables, words and numbers.",
    color: "violet",
  },
  {
    id: "lagoon",
    name: "Loop Lagoon",
    emoji: "🌊",
    blurb: "Repeat things, collect things, build your own tools.",
    color: "sky",
  },
  {
    id: "forest",
    name: "Glitch Forest",
    emoji: "🌲",
    blurb: "Hunt sneaky bugs and make a game decision for you.",
    color: "lime",
  },
];

export const quests = [
  {
    id: "hello",
    track: "basecamp",
    title: "Say hello to the troop",
    emoji: "👋",
    level: "Start here",
    xp: 20,
    story: "Your radio only sends one message at a time, and the troop is listening. Send them a hello.",
    concept:
      "console.log() prints words onto the screen. The words go inside quotes so JavaScript knows they are text.",
    prompt: "Print exactly one line: Hello, Loop Troop!",
    starter: '// 👋 Your very first line of code!\n// Print the message: Hello, Loop Troop!\nconsole.log("");\n',
    hints: [
      'Put the words inside the quotes: console.log("...")',
      'The exact words are Hello, Loop Troop! — capital letters and punctuation matter.',
    ],
    solution: 'console.log("Hello, Loop Troop!");',
    tests: [
      { description: 'Prints "Hello, Loop Troop!"', check: "__logs[0] === 'Hello, Loop Troop!'" },
      { description: "Prints only one line", check: "__logs.length === 1" },
    ],
  },
  {
    id: "variables",
    track: "basecamp",
    title: "Pack your hero stats",
    emoji: "🎒",
    level: "Start here",
    xp: 20,
    story: "Every camper gets a hero card. Fill in the two empty boxes on yours.",
    concept:
      "A variable is a labeled box that holds a value. Use let when the value can change later, or const when it stays the same.",
    prompt: "Make heroName hold the text Nova and powerLevel hold the number 7.",
    starter:
      "// Fill in the two boxes:\n// heroName should be the text Nova\n// powerLevel should be the number 7\n\n",
    hints: [
      'Text goes in quotes, numbers do not: let powerLevel = 7;',
      'const heroName = "Nova";  and  let powerLevel = 7;',
    ],
    solution: 'const heroName = "Nova";\nlet powerLevel = 7;',
    tests: [
      { description: "heroName is the text Nova", check: "typeof heroName === 'string' && heroName === 'Nova'" },
      { description: "powerLevel is the number 7", check: "powerLevel === 7" },
    ],
  },
  {
    id: "strings",
    track: "basecamp",
    title: "Build a name badge",
    emoji: "🪪",
    level: "Easy",
    xp: 20,
    story: "The badge printer needs one line of text with the hero's name and level, joined by a dot.",
    concept:
      "A template literal is text wrapped in backticks. Anything inside ${ } gets swapped for its value.",
    prompt: 'Build badge so it reads exactly: Nova · Level 7',
    starter:
      'const heroName = "Nova";\nconst powerLevel = 7;\n\n// Use a template literal to fill the badge:\nconst badge = "";\n\nconsole.log(badge);\n',
    hints: [
      "Template literals use backticks, not quotes: `...`",
      "`${heroName} · Level ${powerLevel}` — the dot is the · character (copy it from the prompt).",
    ],
    solution:
      'const heroName = "Nova";\nconst powerLevel = 7;\nconst badge = `${heroName} · Level ${powerLevel}`;\nconsole.log(badge);',
    tests: [
      { description: "badge is a string", check: "typeof badge === 'string'" },
      { description: 'badge reads "Nova · Level 7"', check: "badge === 'Nova · Level 7'" },
    ],
  },
  {
    id: "math",
    track: "basecamp",
    title: "Coin math",
    emoji: "🪙",
    level: "Easy",
    xp: 20,
    story: "Supply run! Tickets cost 4 coins each and you also need a 10 coin snack.",
    concept:
      "JavaScript does math with + - * / and %. The % sign means remainder, like the leftover after dividing.",
    prompt: "Set total to the price of 12 tickets plus a 10 coin snack, then set change to what is left from 100 coins.",
    starter:
      "// 12 tickets at 4 coins each, plus a 10 coin snack\nconst total = 0;\n\n// You start with 100 coins\nconst change = 0;\n",
    hints: ["Multiply first: 12 * 4, then add 10.", "const total = 12 * 4 + 10; then const change = 100 - total;"],
    solution: "const total = 12 * 4 + 10;\nconst change = 100 - total;",
    tests: [
      { description: "total is 58", check: "total === 58" },
      { description: "change is 42", check: "change === 42" },
    ],
  },
  {
    id: "if-else",
    track: "basecamp",
    title: "The gatekeeper",
    emoji: "🚪",
    level: "Easy",
    xp: 20,
    story: "The basecamp gate checks ages. Campers 13 and older get in.",
    concept:
      "An if statement runs code only when something is true. Comparison operators are >, <, >=, <=, === and !==.",
    prompt: "Finish canEnter(age) so it returns true when age is 13 or more, and false otherwise.",
    starter:
      "// Return true when the camper is 13 or older\nfunction canEnter(age) {\n  return false;\n}\n\nconsole.log(canEnter(13));\n",
    hints: [
      "You can return a comparison directly: return age >= 13;",
      "The >= operator means 'greater than or equal to'.",
    ],
    solution: "function canEnter(age) {\n  return age >= 13;\n}",
    tests: [
      { description: "canEnter(13) is true", check: "canEnter(13) === true" },
      { description: "canEnter(20) is true", check: "canEnter(20) === true" },
      { description: "canEnter(12) is false", check: "canEnter(12) === false" },
      { description: "canEnter(0) is false", check: "canEnter(0) === false" },
    ],
  },
  {
    id: "logic",
    track: "basecamp",
    title: "Weekend detector",
    emoji: "📅",
    level: "Easy",
    xp: 20,
    story: "The troop's calendar robot keeps scheduling chores on Saturdays. Fix its brain.",
    concept:
      "Combine checks with || (or) and && (and). The ! sign flips true to false.",
    prompt: "Finish isWeekend(day) so it returns true for Saturday and Sunday, and false for everything else.",
    starter:
      '// Return true only for Saturday and Sunday\nfunction isWeekend(day) {\n  return false;\n}\n\nconsole.log(isWeekend("Saturday"));\n',
    hints: [
      "Two separate checks joined with || means 'either one'.",
      'return day === "Saturday" || day === "Sunday";',
    ],
    solution: 'function isWeekend(day) {\n  return day === "Saturday" || day === "Sunday";\n}',
    tests: [
      { description: "Saturday is a weekend", check: "isWeekend('Saturday') === true" },
      { description: "Sunday is a weekend", check: "isWeekend('Sunday') === true" },
      { description: "Monday is not", check: "isWeekend('Monday') === false" },
      { description: "A made-up day is not", check: "isWeekend('Funday') === false" },
    ],
  },
  {
    id: "for-loop",
    track: "lagoon",
    title: "Loop the lanterns",
    emoji: "🏮",
    level: "Easy",
    xp: 30,
    story: "Five lanterns hang over the lagoon. Light them one by one, in order.",
    concept:
      "A for loop repeats code. It has a start (let i = 1), a stop check (i <= 5) and a step (i++ adds one each time).",
    prompt: "Print the numbers 1 through 5, one per line, using a loop.",
    starter:
      "// Print 1, 2, 3, 4, 5 by changing the loop\nfor (let i = 0; i < 0; i++) {\n  console.log(i);\n}\n",
    hints: [
      "Start at 1 and keep going while i <= 5.",
      "for (let i = 1; i <= 5; i++) { console.log(i); }",
    ],
    solution: "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}",
    tests: [
      { description: "Prints five lines", check: "__logs.length === 5" },
      { description: "The lines are 1, 2, 3, 4, 5", check: "__logs.join(',') === '1,2,3,4,5'" },
    ],
  },
  {
    id: "while-loop",
    track: "lagoon",
    title: "Rocket countdown",
    emoji: "🚀",
    level: "Getting warmer",
    xp: 30,
    story: "Mission control wants a countdown that ends with a big GO. You only have a while loop.",
    concept:
      "A while loop repeats as long as its condition stays true. Remember to change the value inside, or it never stops!",
    prompt: 'Build countdown so it prints exactly: 3...2...1...GO!',
    starter:
      'let n = 3;\nlet countdown = "";\n\n// While n is greater than 0:\n//   add n and "..." to countdown\n//   then subtract 1 from n\n\ncountdown += "GO!";\nconsole.log(countdown);\n',
    hints: [
      "Inside the loop: countdown += n + \"...\"; then n -= 1;",
      'while (n > 0) { countdown += n + "..."; n -= 1; }',
    ],
    solution:
      'let n = 3;\nlet countdown = "";\nwhile (n > 0) {\n  countdown += n + "...";\n  n -= 1;\n}\ncountdown += "GO!";\nconsole.log(countdown);',
    tests: [
      { description: 'countdown is "3...2...1...GO!"', check: "countdown === '3...2...1...GO!'" },
      { description: "It also prints that same line", check: "__logs[0] === '3...2...1...GO!'" },
      { description: "The loop did not run forever", check: "n === 0" },
    ],
  },
  {
    id: "arrays",
    track: "lagoon",
    title: "Creature collection",
    emoji: "🦎",
    level: "Getting warmer",
    xp: 30,
    story: "The lagoon field guide needs one more creature on the list, and a note of the last one added.",
    concept:
      "An array is an ordered list. push() adds to the end, length counts items, and positions start at 0.",
    prompt: 'Add "moth" to the end of creatures, then store the last creature in lastCreature.',
    starter:
      'const creatures = ["axolotl", "gecko"];\n\n// Add "moth" to the end of the list\n\n// Save the very last creature in the list\nconst lastCreature = creatures[0];\n',
    hints: [
      "creatures.push(\"moth\") adds it to the end.",
      "creatures.length - 1 is the position of the last item.",
    ],
    solution:
      'const creatures = ["axolotl", "gecko"];\ncreatures.push("moth");\nconst lastCreature = creatures[creatures.length - 1];',
    tests: [
      { description: "The list has three creatures", check: "Array.isArray(creatures) && creatures.length === 3" },
      { description: "moth was added at the end", check: "creatures[2] === 'moth'" },
      { description: "lastCreature is moth", check: "lastCreature === 'moth'" },
      { description: "The first creature is still an axolotl", check: "creatures[0] === 'axolotl'" },
    ],
  },
  {
    id: "functions",
    track: "lagoon",
    title: "Double the snacks",
    emoji: "🍪",
    level: "Getting warmer",
    xp: 30,
    story: "The snack machine halves every order by accident. Write the tool that fixes it.",
    concept:
      "A function takes input, does a job, and returns a result. map() builds a new array by transforming every item.",
    prompt: "Finish doubleAll(numbers) so it returns a new list with every number doubled.",
    starter:
      "// doubleAll([1, 2, 3]) should return [2, 4, 6]\nfunction doubleAll(numbers) {\n  return numbers;\n}\n\nconsole.log(doubleAll([1, 2, 3]));\n",
    hints: [
      "numbers.map(...) makes a new array from the old one.",
      "numbers.map((n) => n * 2) doubles each value.",
    ],
    solution: "function doubleAll(numbers) {\n  return numbers.map((n) => n * 2);\n}",
    tests: [
      { description: "doubleAll([1, 2, 3]) returns [2, 4, 6]", check: "JSON.stringify(doubleAll([1, 2, 3])) === '[2,4,6]'" },
      { description: "An empty list stays empty", check: "JSON.stringify(doubleAll([])) === '[]'" },
      { description: "Negatives and zero work too", check: "JSON.stringify(doubleAll([-1, 0, 2])) === '[-2,0,4]'" },
    ],
  },
  {
    id: "bug-fix",
    track: "forest",
    title: "The score bug",
    emoji: "🐛",
    level: "Boss",
    xp: 40,
    story: "The troop's score counter is off by a lot. Two sneaky bugs, one small function. You got this.",
    concept:
      "Debugging is detective work: read the code, find what it does, compare it with what it should do. Off-by-one bugs hide in loop bounds.",
    prompt: "Fix totalPoints so it adds up every score. There are two bugs in the loop.",
    starter:
      "// 🐛 This should add up all the scores. It has TWO bugs.\nfunction totalPoints(scores) {\n  let total = 0;\n  for (let i = 1; i <= scores.length; i++) {\n    total += scores[i];\n  }\n  return total;\n}\n\nconsole.log(totalPoints([5, 5, 5]));\n",
    hints: [
      "Arrays start at position 0, so the first score is scores[0].",
      "The last position is length - 1, so the loop should run while i < scores.length.",
    ],
    solution:
      "function totalPoints(scores) {\n  let total = 0;\n  for (let i = 0; i < scores.length; i++) {\n    total += scores[i];\n  }\n  return total;\n}",
    tests: [
      { description: "totalPoints([1, 2, 3]) is 6", check: "totalPoints([1, 2, 3]) === 6" },
      { description: "An empty list scores 0", check: "totalPoints([]) === 0" },
      { description: "It works with mixed numbers", check: "totalPoints([10, -2, 4]) === 12" },
    ],
  },
  {
    id: "rps",
    track: "forest",
    title: "Rock, paper, scissors judge",
    emoji: "✂️",
    level: "Boss",
    xp: 40,
    story: "The troop's tournament has no referee. Write the judge so nobody argues.",
    concept:
      "Boss quest! Combine functions, comparisons, logic and if/else. Rock beats scissors, scissors beats paper, paper beats rock.",
    prompt: 'Finish judge(a, b) so it returns "A wins", "B wins" or "Tie".',
    starter:
      '// Return "A wins", "B wins" or "Tie"\nfunction judge(a, b) {\n  if (a === b) return "Tie";\n  return "B wins";\n}\n\nconsole.log(judge("rock", "scissors"));\n',
    hints: [
      "Check for a tie first, then check each winning case for A.",
      'if ((a === "rock" && b === "scissors") || (a === "scissors" && b === "paper") || (a === "paper" && b === "rock")) return "A wins";',
    ],
    solution:
      'function judge(a, b) {\n  if (a === b) return "Tie";\n  if (a === "rock" && b === "scissors") return "A wins";\n  if (a === "scissors" && b === "paper") return "A wins";\n  if (a === "paper" && b === "rock") return "A wins";\n  return "B wins";\n}',
    tests: [
      { description: "rock beats scissors", check: "judge('rock', 'scissors') === 'A wins'" },
      { description: "scissors beats paper", check: "judge('scissors', 'paper') === 'A wins'" },
      { description: "paper beats rock", check: "judge('paper', 'rock') === 'A wins'" },
      { description: "scissors loses to rock", check: "judge('scissors', 'rock') === 'B wins'" },
      { description: "paper loses to scissors", check: "judge('paper', 'scissors') === 'B wins'" },
      { description: "rock loses to paper", check: "judge('rock', 'paper') === 'B wins'" },
      { description: "Same move is a tie", check: "judge('rock', 'rock') === 'Tie'" },
    ],
  },
];

export function getQuest(id) {
  return quests.find((quest) => quest.id === id) || null;
}

/** Everything the browser is allowed to see (checks stay on the server). */
export const publicQuests = quests.map(({ tests, ...rest }) => ({
  ...rest,
  testCount: tests.length,
  testList: tests.map((test) => test.description),
}));
