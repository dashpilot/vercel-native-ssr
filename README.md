# Vercel Native SSR

A simple, PHP-like server-first rendering library for Vercel. Just create `.html` files in the `routes/` folder, and they automatically become server-rendered pages with file-based routing.

## Features

- 🚀 **Runtime rendering** - No build step required
- 📁 **File-based routing** - Files in `routes/` map to URLs automatically
- 📝 **Handlebars templating** - Familiar templating syntax
- 🎯 **Native JavaScript** - Write normal JavaScript in your route files
- ⚡ **Vercel optimized** - Works seamlessly with Vercel's serverless functions

## Installation

```bash
npm install
```

## Usage

1. Create a file in the `routes/` folder, e.g., `routes/about.html`
2. Write your server-side code in `<script>` tags
3. Write your Handlebars template in `<template>` tags
4. Export data using `exports`
5. Access your page at the corresponding URL (e.g., `/about`)

### Example Route File

```html
<script>
// Fetch some data
const response = await fetch('https://api.example.com/data');
const items = await response.json();

// Export data to template
exports.items = items;
exports.title = 'My Page';
</script>

<template>
<!DOCTYPE html>
<html>
<head>
    <title>{{title}}</title>
</head>
<body>
    <h1>{{title}}</h1>
    <ul>
    {{#each items}}
        <li>{{this}}</li>
    {{/each}}
    </ul>
</body>
</html>
</template>
```

### File Structure

```
/
├── routes/
│   ├── index.html      → /
│   └── about.html      → /about
├── api/
│   └── [[...path]].js  (catch-all handler)
└── src/
    └── index.js      (core library)
```

## Development

```bash
npm run dev
```

This starts Vercel's development server. Visit `http://localhost:3000` to see your routes.

## How It Works

1. All requests are caught by the catch-all route handler in `api/[[...path]].js`
2. The handler maps the URL path to a file in the `routes/` folder
3. The route file is parsed to extract `<script>` and `<template>` sections
4. The script is executed at runtime (with access to `fetch`, `exports`, etc.)
5. The template is compiled with Handlebars and rendered with the data
6. The HTML is returned to the client

## API

### Route File Format

Your route files must contain:
- `<script>` - JavaScript code that runs on the server
- `<template>` - Handlebars template that gets rendered

### Available in Script Context

- `exports` - Object to export data to the template
- `fetch` - Native fetch API
- `req` - Vercel request object (headers, query params, etc.)
- Standard JavaScript globals (`URL`, `console`, etc.)

### Example with Request Data

```html
<script>
// Access query parameters
const searchQuery = req.query.q || 'default';

// Fetch based on query
const response = await fetch(`https://api.example.com/search?q=${searchQuery}`);
const results = await response.json();

exports.results = results;
exports.query = searchQuery;
</script>

<template>
<h1>Results for: {{query}}</h1>
{{#each results}}
  <div>{{this}}</div>
{{/each}}
</template>
```

## License

MIT

