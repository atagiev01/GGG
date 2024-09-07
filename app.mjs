import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Get current directory name for ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 4000;

// Middleware to parse JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const jsonDataPath = path.join(__dirname, 'data', 'categories.json');
fs.readFile(jsonDataPath, (err, data) => {
  if (err) {
      // If the file does not exist, create it with an initial structure
      if (err.code === 'ENOENT') {
          const initialData = {
              en: { categories: [] },
              az: { categories: [] }
          };
          fs.writeFile(jsonDataPath, JSON.stringify(initialData, null, 2), (writeErr) => {
              if (writeErr) {
                  return res.status(500).send('Error creating file.');
              }
              // Proceed to push the new category
              jsonData = initialData;
              jsonData.en.categories.push(newCategory);
              jsonData.az.categories.push(newCategory);
              fs.writeFile(jsonDataPath, JSON.stringify(jsonData, null, 2), (writeErr) => {
                  if (writeErr) {
                      return res.status(500).send('Error writing file.');
                  }
                  res.json(newCategory);
              });
          });
      } else {
          return res.status(500).send('Error reading file.');
      }
  }
  // Continue with the existing logic to parse and write data
});

app.post('/data/categories', (req, res) => {
  let body = '';

  req.on('data', chunk => {
      body += chunk.toString(); // Collect the request data
  });

  req.on('end', () => {
      const newCategory = JSON.parse(body);
      newCategory.id = Date.now(); // Unique id based on timestamp
      newCategory.items = []; // New category items array

      const jsonDataPath = path.join(__dirname, 'data.json');

      fs.readFile(jsonDataPath, (err, data) => {
          if (err) {
              // Check if the file doesn't exist
              if (err.code === 'ENOENT') {
                  // Initialize with empty structure
                  const initialData = { en: { categories: [] }, az: { categories: [] } };
                  fs.writeFile(jsonDataPath, JSON.stringify(initialData, null, 2), (writeErr) => {
                      if (writeErr) {
                          return res.status(500).send('Error creating file.');
                      }
                      // Proceed to add the new category
                      initialData.en.categories.push(newCategory);
                      initialData.az.categories.push(newCategory);
                      fs.writeFile(jsonDataPath, JSON.stringify(initialData, null, 2), (writeErr) => {
                          if (writeErr) {
                              return res.status(500).send('Error writing file.');
                          }
                          res.json(newCategory);
                      });
                  });
              } else {
                  return res.status(500).send('Error reading file.');
              }
          } else {
              const jsonData = JSON.parse(data);
              jsonData.en.categories.push(newCategory);
              jsonData.az.categories.push(newCategory);

              fs.writeFile(jsonDataPath, JSON.stringify(jsonData, null, 2), (err) => {
                  if (err) {
                      return res.status(500).send('Error writing file.');
                  }
                  res.json(newCategory);
              });
          }
      });
  });
});



// Modified saveData to debug JSON writing
function saveData(data) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, 'data', 'categories.json');
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
      if (err) {
        console.error('Error saving JSON file:', err);
        return reject(err);
      }
      resolve();
    });
  });
}




// Dummy user data - consider using a database for real applications
const users = [
  { username: 'admin', password: bcrypt.hashSync('12', 2) }
];

app.get('/login', (req, res) => {
  res.render('login'); // 'login.ejs' şablonunu render edir
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).send('Invalid credentials');
  }

  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'YOUR_SECRET_KEY', { expiresIn: '1h' });
  res.cookie('token', token); // Token-i cookie-yə əlavə edin
  res.redirect('/dashboard'); // İstifadəçini dashboard-a yönləndirin
});
app.get('/logout', (req, res) => {
  res.clearCookie('token'); // Tokeni silin
  res.redirect('/login'); // İstifadəçini giriş səhifəsinə yönləndirin
});


app.get('/dashboard', (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SECRET_KEY', (err, decoded) => {
    if (err) {
      return res.status(401).send('Unauthorized: Invalid token');
    }

    // Token etibarlıdır, istifadəçi məlumatını əldə edin
    res.render('dashboard', { username: decoded.username }); // dashboard.ejs şablonunu render edin
  });
});

// Middleware to check if the user is authenticated
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { username: req.user.username });
});

function isAuthenticated(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect('/'); // Ana səhifəyə yönləndir
  }

  jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SECRET_KEY', (err, decoded) => {
    if (err) {
      return res.redirect('/'); // Ana səhifəyə yönləndir
    }

    req.user = decoded; // İstifadəçi məlumatını req obyektinə əlavə et
    next(); // Növbəti middleware-ə keç
  });
}


// Apply authentication middleware to protected routes
app.use('/dashboard', isAuthenticated);
app.use('/logout', isAuthenticated);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});


// Load JSON data
let cachedData;

async function loadData() {
  if (!cachedData) {
    cachedData = await readJSONFile(path.join(__dirname, 'data', 'categories.json'));
  }
  return cachedData;
}

function readJSONFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        return reject('Error reading JSON file');
      }
      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (parseError) {
        reject('Error parsing JSON file');
      }
    });
  });
}

// Middleware to handle language settings
app.use((req, res, next) => {
  const lang = req.cookies.lang || 'en'; // Default language is 'en'
  res.locals.lang = lang; // Store language in response locals
  next();
});

app.get('/', async (req, res) => {
  try {
    const lang = req.query.lang || req.cookies.lang || 'en';
    const data = await loadData(); // Load cached data or read from file
    const homesection = data[lang]?.homesection || []; // Use optional chaining
    const categories = data[lang]?.categories || [];

    if (!homesection.length) {
      console.error('Homesection is missing in data');
    }

    // Render the template with both categories and homesection data
    res.render('index', { homesection, categories, lang });
  } catch (error) {
    console.error('Error loading data:', error);
    res.status(500).send('Error loading data');
  }
});

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

app.get('/change-lang/:lang', (req, res) => {
  const newLang = req.params.lang;
  res.cookie('lang', newLang); // Set the cookie
  res.redirect('back'); // Redirect back to the previous page
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
