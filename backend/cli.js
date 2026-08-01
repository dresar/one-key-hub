const readline = require('readline');

// ANSI escape code untuk warna hijau terang
const GREEN = '\x1b[92m';
const RESET = '\x1b[0m';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion() {
  rl.question('Anda > ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    // Logika pemanggilan AI (simulasi)
    process.stdout.write(`${GREEN}AI >${RESET} Sedang memproses...\n`);
    
    // Di sini Anda bisa menambahkan integrasi API AI yang sesungguhnya
    const response = `Anda mengatakan: ${input}`;
    
    console.log(`${GREEN}AI >${RESET} ${response}`);
    
    askQuestion();
  });
}

console.log('CLI AI dimulai. Ketik "exit" untuk keluar.');
askQuestion();
