const fs = require('fs');
const path = require('path');

const providersDir = path.join(__dirname, 'src', 'providers');

if (!fs.existsSync(providersDir)) {
  fs.mkdirSync(providersDir, { recursive: true });
}

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini', placeholder: 'AIzaSy...', group: 'AI', docUrl: 'https://aistudio.google.com/', howToGet: 'Sign in to Google AI Studio and click "Create API Key".' },
  { value: 'groq', label: 'Groq', placeholder: 'gsk_...', group: 'AI', docUrl: 'https://console.groq.com/keys', howToGet: 'Go to Groq Console, navigate to API Keys, and click "Create API Key".' },
  { value: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...', group: 'AI', docUrl: 'https://platform.deepseek.com/', howToGet: 'Log in to DeepSeek Platform, go to API Keys page, and click "Create API Key".' },
  { value: 'huggingface', label: 'Hugging Face', placeholder: 'hf_...', group: 'AI', docUrl: 'https://huggingface.co/settings/tokens', howToGet: 'Go to Hugging Face Settings -> Access Tokens and click "New token".' },
  { value: 'cohere', label: 'Cohere', placeholder: 'your-api-key', group: 'AI', docUrl: 'https://dashboard.cohere.com/api-keys', howToGet: 'Log in to Cohere Dashboard, go to API Keys, and copy your developer key.' },
  { value: 'mistral', label: 'Mistral AI', placeholder: 'your-api-key', group: 'AI', docUrl: 'https://console.mistral.ai/api-keys/', howToGet: 'Go to Mistral Console, open API Keys, and click "Create new key".' },
  { value: 'cerebras', label: 'Cerebras', placeholder: 'csk_...', group: 'AI', docUrl: 'https://cloud.cerebras.ai/', howToGet: 'Go to Cerebras Cloud Console, sign up/log in, and generate a new API key.' },
  
  { value: 'cloudinary', label: 'Cloudinary', placeholder: 'cloud_name|api_key|api_secret', group: 'Media', docUrl: 'https://cloudinary.com/console', howToGet: 'Log in to Cloudinary, copy Cloud Name, API Key, and API Secret from Dashboard. Combine with "|" separators.' },
  { value: 'imagekit', label: 'ImageKit', placeholder: 'public_key|private_key|url_endpoint', group: 'Media', docUrl: 'https://imagekit.io/dashboard/developer/api-keys', howToGet: 'Go to Developer Options in ImageKit Dashboard and copy Public Key, Private Key, and URL Endpoint. Combine with "|" separators.' },
  { value: 'uploadcare', label: 'Uploadcare', placeholder: 'public_key|secret_key', group: 'Media', docUrl: 'https://uploadcare.com/dashboard/', howToGet: 'Go to Uploadcare Console, open your project settings -> API Keys. Combine with "|" separator.' },

  { value: 'removebg', label: 'Remove.bg', placeholder: 'api-key', group: 'Media', docUrl: 'https://www.remove.bg/dashboard#api-key', howToGet: 'Go to remove.bg, log in, navigate to Tools & API -> API Keys, and create a new key.' },
  
  { value: 'pexels', label: 'Pexels', placeholder: 'api-key', group: 'Stock Images', docUrl: 'https://www.pexels.com/api/new/', howToGet: 'Register for a Pexels API account, and request your API key.' },
  { value: 'pixabay', label: 'Pixabay', placeholder: 'api-key', group: 'Stock Images', docUrl: 'https://pixabay.com/api/docs/', howToGet: 'Register/Log in on Pixabay, visit API documentation. Your key is displayed on the page.' },
  { value: 'unsplash', label: 'Unsplash', placeholder: 'access-key', group: 'Stock Images', docUrl: 'https://unsplash.com/oauth/applications', howToGet: 'Create a developer application on Unsplash, and get your Access Key.' },
  { value: 'giphy', label: 'GIPHY', placeholder: 'api-key', group: 'Stock Images', docUrl: 'https://developers.giphy.com/dashboard/', howToGet: 'Go to GIPHY Developer Console, create an app, and copy the API key.' },
  
  { value: 'supabase', label: 'Supabase', placeholder: 'anon-key', group: 'Database', docUrl: 'https://supabase.com/dashboard', howToGet: 'Open your Supabase project settings -> API and copy the `anon` public key.' },
  { value: 'firebase', label: 'Firebase', placeholder: 'apiKey', group: 'Database', docUrl: 'https://console.firebase.google.com/', howToGet: 'Go to Firebase Project Settings -> General -> Web App configuration, and copy the `apiKey`.' },
  { value: 'appwrite', label: 'Appwrite', placeholder: 'project-api-key', group: 'Database', docUrl: 'https://cloud.appwrite.io/', howToGet: 'Go to Appwrite Console, select your project -> API Keys, and click "Create API Key".' },
  { value: 'neon', label: 'Neon PostgreSQL', placeholder: 'connection-string', group: 'Database', docUrl: 'https://console.neon.tech/', howToGet: 'Log in to Neon Console, select your database project, and copy the connection string.' },
  { value: 'planetscale', label: 'PlanetScale', placeholder: 'password', group: 'Database', docUrl: 'https://app.planetscale.com/', howToGet: 'Log in to PlanetScale, go to your Database Settings -> Passwords, and click "New Password".' },
  
  { value: 'openweather', label: 'OpenWeather', placeholder: 'api-key', group: 'Weather', docUrl: 'https://home.openweathermap.org/api_keys', howToGet: 'Register an account on OpenWeatherMap and get your API key (AppID) from API Keys tab.' },
  { value: 'weatherapi', label: 'WeatherAPI', placeholder: 'api-key', group: 'Weather', docUrl: 'https://www.weatherapi.com/my/', howToGet: 'Log in to WeatherAPI dashboard, and copy your API Key.' },
  { value: 'tomorrowio', label: 'Tomorrow.io', placeholder: 'api-key', group: 'Weather', docUrl: 'https://app.tomorrow.io/development/keys', howToGet: 'Sign up for a Tomorrow.io account, open the Development menu -> API Keys, and copy your key.' },
  
  { value: 'serper', label: 'Serper', placeholder: 'api-key', group: 'Search', docUrl: 'https://serper.dev/api-key', howToGet: 'Sign up on Serper.dev and copy your API key from the dashboard.' },
  { value: 'serpapi', label: 'SerpAPI', placeholder: 'api-key', group: 'Search', docUrl: 'https://serpapi.com/dashboard', howToGet: 'Log in to SerpAPI dashboard, and copy your API Key from developer options.' },
  { value: 'brave', label: 'Brave Search', placeholder: 'api-key', group: 'Search', docUrl: 'https://api.search.brave.com/register', howToGet: 'Register on Brave Search API Dashboard, choose a plan, and generate your API key.' },
  { value: 'tavily', label: 'Tavily', placeholder: 'tvly-...', group: 'Search', docUrl: 'https://tavily.com/', howToGet: 'Sign up on Tavily and copy the API key from your workspace dashboard.' },
  { value: 'exa', label: 'Exa Search', placeholder: 'exa-...', group: 'Search', docUrl: 'https://dashboard.exa.ai/', howToGet: 'Register for Exa Search, go to dashboard, and copy your API Key.' },
  
  { value: 'mapbox', label: 'Mapbox', placeholder: 'pk....', group: 'Maps', docUrl: 'https://account.mapbox.com/', howToGet: 'Log in to Mapbox, and copy your Default Public Token from Dashboard.' },
  { value: 'locationiq', label: 'LocationIQ', placeholder: 'api-key', group: 'Maps', docUrl: 'https://locationiq.com/register', howToGet: 'Register an account and copy the API token from the LocationIQ Dashboard.' },
  { value: 'tomtom', label: 'TomTom', placeholder: 'api-key', group: 'Maps', docUrl: 'https://developer.tomtom.com/user/register', howToGet: 'Register a developer account on TomTom Developer Portal and copy your API key.' },
  
  { value: 'currencyapi', label: 'CurrencyAPI', placeholder: 'api-key', group: 'Finance', docUrl: 'https://currencyapi.com/dashboard', howToGet: 'Create a free account on CurrencyAPI and copy your token from dashboard.' },
  { value: 'fixerio', label: 'Fixer.io', placeholder: 'api-key', group: 'Finance', docUrl: 'https://fixer.io/dashboard', howToGet: 'Sign up on Fixer.io, choose the free tier, and copy your API Access Key.' },
  { value: 'alphavantage', label: 'Alpha Vantage', placeholder: 'api-key', group: 'Finance', docUrl: 'https://www.alphavantage.co/support/#api-key', howToGet: 'Fill out the form on Alpha Vantage site to claim a free API key.' },
  
  { value: 'newsapi', label: 'NewsAPI', placeholder: 'api-key', group: 'News', docUrl: 'https://newsapi.org/register', howToGet: 'Register an account on NewsAPI and copy your API key.' },
  { value: 'mediastack', label: 'MediaStack', placeholder: 'api-key', group: 'News', docUrl: 'https://mediastack.com/dashboard', howToGet: 'Register on MediaStack dashboard, select the free plan, and get your API Access Key.' },
  { value: 'currents', label: 'Currents API', placeholder: 'api-key', group: 'News', docUrl: 'https://currentsapi.services/en/register', howToGet: 'Log in to Currents API website and generate a developer token.' },
  
  { value: 'rapidapi', label: 'RapidAPI', placeholder: 'api_key|rapidapi_host', group: 'Utility', docUrl: 'https://rapidapi.com/developer/dashboard', howToGet: 'Create a RapidAPI account, open any API page, and find your X-RapidAPI-Key and X-RapidAPI-Host in header params. Separate them with "|".' },
  { value: 'apify', label: 'Apify', placeholder: 'apify_api_...', group: 'Utility', docUrl: 'https://console.apify.com/account/integrations', howToGet: 'Go to Apify Console -> Account -> Integrations and copy your API token.' },
  { value: 'ipinfo', label: 'IPinfo', placeholder: 'token', group: 'Utility', docUrl: 'https://ipinfo.io/signup', howToGet: 'Register for IPinfo account, and copy your API Token from the dashboard.' },
  { value: 'ipapi', label: 'IPAPI', placeholder: 'api-key', group: 'Utility', docUrl: 'https://ipapi.co/', howToGet: 'Sign up for IPAPI key to exceed rate limits, copy the key from your dashboard.' },
  { value: 'abstractapi', label: 'Abstract API', placeholder: 'api-key', group: 'Utility', docUrl: 'https://app.abstractapi.com/', howToGet: 'Sign up on Abstract API and copy the API key for your chosen API category.' },
  { value: 'jsonbin', label: 'JSONBin.io', placeholder: 'api-key', group: 'Utility', docUrl: 'https://jsonbin.io/app/api-keys', howToGet: 'Go to JSONBin Dashboard -> API Keys and copy your API Key.' }
];

// Write individual files
PROVIDERS.forEach((prov) => {
  const content = `// Provider Configuration: ${prov.label}
export default {
  value: '${prov.value}',
  label: '${prov.label}',
  placeholder: '${prov.placeholder}',
  group: '${prov.group}',
  docUrl: '${prov.docUrl}',
  howToGet: \`${prov.howToGet.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
  apiKeyField: 'api_key'
};
`;
  fs.writeFileSync(path.join(providersDir, `${prov.value}.ts`), content);
});

// Write index.ts
const imports = PROVIDERS.map(p => `import ${p.value} from './${p.value}';`).join('\n');
const exportsList = PROVIDERS.map(p => `  ${p.value}`).join(',\n');

const indexContent = `${imports}

export const providersList = [
${exportsList}
];

export default providersList;
`;

fs.writeFileSync(path.join(providersDir, 'index.ts'), indexContent);

console.log('✅ Generated 45 provider TS files and providers/index.ts successfully');
