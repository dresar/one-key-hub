const readline = require('readline');
const chalk = require('chalk');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = chalk.blue.bold('CLI > ');

rl.setPrompt(prompt);
rl.prompt();

rl.on('line', (line) => {
  console.log(chalk.green('Anda mengetik: ') + chalk.yellow(line));
  rl.prompt();
}).on('close', () => {
  console.log(chalk.magenta('Terima kasih, sampai jumpa!'));
  process.exit(0);
});
