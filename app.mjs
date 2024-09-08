import express from 'express';
import path from 'path';
import fs from 'fs/promises'; // Use promises-based fs
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

// Get current directory name for ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4000;

// Middleware to parse JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Load JSON data
let cachedData;

async function loadData() {
  if (!cachedData) {
      const filePath = path.join(__dirname, 'data', 'categories.json');
      try {
          const data = await fs.readFile(filePath, 'utf8');
          cachedData = JSON.parse(data);
      } catch (err) {
          if (err.code === 'ENOENT') {
              cachedData = { categories: [] }; // Yalnız bir dildə
              await fs.writeFile(filePath, JSON.stringify(cachedData, null, 2), 'utf8');
          } else {
              throw new Error('Error reading or parsing JSON file');
          }
      }
  }
  return cachedData;
}
app.get('/category/:id', async (req, res) => {
  const lang = req.query.lang || req.cookies.lang || 'az';
  const categoryId = parseInt(req.params.id, 10);

  if (isNaN(categoryId)) {
    return res.status(400).send('Invalid category ID');
  }

  try {
    const jsonData = await loadData();
    const categories = jsonData[lang]?.categories || [];
    const category = categories.find(c => c.id === categoryId);

    if (!category) {
      return res.status(404).send('Category not found');
    }

    res.render('category', { category, lang });
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/item/:id', async (req, res) => {
  const lang = req.query.lang || req.cookies.lang || 'az';
  const itemId = parseInt(req.params.id, 10);

  if (isNaN(itemId)) {
    return res.status(400).send('Invalid item ID');
  }

  try {
    const data = await loadData();
    const categories = data[lang]?.categories || [];
    let foundItem = null;

    for (const category of categories) {
      const item = category.items.find(i => i.id === itemId);
      if (item) {
        foundItem = item;
        break;
      }
    }

    if (!foundItem) {
      return res.status(404).send('Item not found');
    }

    res.render('item', { item: foundItem, lang });
  } catch (error) {
    console.error('Error loading item data:', error);
    res.status(500).send('Error loading item data');
  }
});
async function saveData(data) {
  const filePath = path.join(__dirname, 'data', 'categories.json');
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8'); // Promises-based fs istifadə
}


async function createCategory(event) {
  event.preventDefault(); // Formun göndərilməsini dayandırır

  const formData = new FormData(document.getElementById('categoryForm'));
  const data = Object.fromEntries(formData.entries());

  try {
      const response = await fetch('/data/categories', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json', // Başlıqları düzgün təyin edin
          },
          body: JSON.stringify(data),
      });

      if (!response.ok) {
          throw new Error('Error creating category');
      }

      const newCategory = await response.json();
      console.log('Category created:', newCategory);
  } catch (error) {
      console.error('Error creating category:', error);
  }
}

app.get('/data/categories', async (req, res) => {
  try {
    const data = await loadData();
    console.log(data); // Veriyi kontrol etmek için
    res.json(data);
  } catch (err) {
    console.error('Error reading JSON file:', err);
    res.status(500).send('Server error');
  }
});


app.post('/data/categories/:language', async (req, res) => {
  const { language } = req.params;
  const newCategory = {
      id: Date.now(),
      title: req.body.title,
      description: req.body.description,
      imgSrc: req.body.imgSrc,
      items: [req.body], // 'items' hissəsinə yeni məlumatı əlavə edin
  };

  try {
      const jsonData = await loadData();
      jsonData[language].categories.push(newCategory);
      await saveData(jsonData); // saveData funksiyasını istifadə edin
      res.status(201).json(newCategory);
  } catch (error) {
      console.error('Error saving category:', error);
      res.status(500).send('Internal Server Error');
  }
});





// Authentication logic
const users = [{ username: 'admin', password: bcrypt.hashSync('12', 2) }];

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).send('Invalid credentials');
    }

    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'YOUR_SECRET_KEY', { expiresIn: '1h' });
    res.cookie('token', token);
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// Middleware for authentication
function isAuthenticated(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SECRET_KEY', (err, decoded) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = decoded;
        next();
    });
}

app.use('/dashboard', isAuthenticated);

app.get('/dashboard', (req, res) => {
    res.render('dashboard', { username: req.user.username });
});

// Load and render the main index page
app.get('/', async (req, res) => {
    try {
        const lang = req.query.lang || req.cookies.lang || 'en';
        const data = await loadData();
        const homesection = data[lang]?.homesection || [];
        const categories = data[lang]?.categories || [];
        res.render('index', { homesection, categories, lang });
    } catch (error) {
        console.error('Error loading data:', error);
        res.status(500).send('Error loading data');
    }
});

// Language change endpoint
app.get('/change-lang/:lang', (req, res) => {
    const newLang = req.params.lang;
    res.cookie('lang', newLang);
    res.redirect('back');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
