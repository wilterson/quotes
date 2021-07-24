const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const axios = require('axios');
const cheerio = require('cheerio');

require('dotenv').config();

const middlewares = require('./middlewares');

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/quotes', async (req, res) => {
  const data = [];
  let page = 1;
  let hasMorePages = true;
  let link = 'http://quotes.toscrape.com';
  let selector = '.quote';

  // Get query params to filter results by author or specific tag
  const { tag, author } = req.query;

  if (author) {
    selector = `.quote:has(small.author:contains('${author}'))`;
  }

  if (tag) {
    link += `/tag/${tag}`;
  }

  while (hasMorePages) {
    const $ = await fetchHTML(`${link}/page/${page}`);

    hasMorePages = $('li.next').length > 0;

    $(selector).each((i, e) => {
      const author = $(e).find('.author').text();
      const text = $(e).find('.text').text().trim()
        .slice(0, 50);

      const tags = [];

      $(e).find('.tags a.tag').each((i, e) => {
        const tag = $(e).text();
        tags.push(tag);
      });

      data.push({
        author,
        text,
        tags,
      });
    });

    page++;
  }

  res.send({
    data
  });
});

app.get('/authors', async (req, res) => {
  let aboutLinks = [];
  let data = [];
  let page = 1;
  let hasMorePages = true;
  let selector = 'small.author';

  // Filter specific author
  const { name } = req.query;
  if (name) {
    selector = `small.author:contains('${name}')`;
  }

  // Get all authors
  while (hasMorePages) {
    const $ = await fetchHTML(`http://quotes.toscrape.com/page/${page}`);

    hasMorePages = $('li.next').length > 0;

    $(`${selector} + a`).each((i, e) => {
      const link = $(e).attr('href');
      aboutLinks.push(link);
    });

    // If has name filter, has to found at least one link
    if (name && aboutLinks.length >= 1) {
      hasMorePages = false;
    }

    page++;
  }

  aboutLinks = [...new Set(aboutLinks)];

  // Get biography of every author;
  data = await Promise.all(aboutLinks.map(async (link) => {
    link = `https://quotes.toscrape.com${link}`;

    const $ = await fetchHTML(link);

    const name = $('.author-title').text();
    const biography = $('.author-description').text().trim().slice(0, 50);
    const birthdate = $('span.author-born-date').text().trim();
    const location = $('span.author-born-location').text().trim();

    return {
      name, biography, birthdate, location
    };
  }));

  res.status(200);
  res.send({
    data
  });
});

const fetchHTML = async (url) => {
  const { data } = await axios.get(url);
  return cheerio.load(data);
};

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
