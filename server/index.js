import express from 'express';
import serveStatic from 'serve-static';
import bodyParser from 'body-parser';

const app = express();

// Middleware setup
app.use(
  serveStatic(new URL('../app/', import.meta.url).pathname, {
    cacheControl: false,
    lastModified: false,
  })
);
app.use(bodyParser.text());
app.use(bodyParser.json());

export default function ({ handleData, json2markdown }) {
  const server = app.listen();

  // Endpoint for handling data
  app.post('/', (req, res) => {
    try {
      handleData(req.body);
    } catch (err) {
      console.error(err);
    }
    res.end();
    server.close(); // Close the server after request handling
  });

  // Endpoint for converting JSON to markdown
  app.post('/json2markdown', (req, res) => {
    res.send(json2markdown(req.body));
  });

  return server.address().port; // Return the server's port
}
