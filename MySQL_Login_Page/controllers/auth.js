const mysql = require("mysql");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { promisify } = require("util");

const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.DATABASE_USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user.id);
  
    const cookieOptions = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
      httpOnly: true
    };
  
    res.cookie('userSave', token, cookieOptions);
  
    res.status(statusCode).redirect("/");
  };
  
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).sendFile(__dirname + "/login.html", {
                message: "Please provide an email and password"
            });
        }
        db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
            console.log(results);
            if (!results || !await bcrypt.compare(password, results[0].password)) {
                res.status(401).sendFile(__dirname + '/login.html', {
                    message: 'Email or password is incorrect'
                });
            } else {
                createSendToken(results[0], 200, res);
            }
        });
    } catch (err) {
        console.log(err);
    }
};

exports.register = (req, res) => {
    console.log(req.body);
    const { name, email, password, passwordConfirm } = req.body;
    db.query('SELECT email from users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            console.log(err);
        } else {
            if (results.length > 0) {
                return res.sendFile(__dirname + "request.html", {
                    message: 'The email is already in use'
                });
            } else if (password != passwordConfirm) {
                return res.sendFile(__dirname + "request.html", {
                    message: 'Passwords do not match'
                });
            }
        }

        let hashedPassword = await bcrypt.hash(password, 8);
        console.log(hashedPassword);

        db.query('INSERT INTO users SET ?', { name: name, email: email, password: hashedPassword }, (err, results) => {
            if (err) {
                console.log(err);
            } else {
                return res.sendFile(__dirname + "request.html", {
                    message: 'User registered'
                });
            }
        });
    });
    res.send("Form submitted");
};

exports.isLoggedIn = async (req, res, next) => {
    if (req.cookies.userSave) {
      try {
        // 1. Decode the token
        const decoded = jwt.verify(req.cookies.userSave, process.env.JWT_SECRET);
  
        if (!decoded) {
          // Token is invalid or expired, clear the cookie and continue to the next middleware
          res.clearCookie('userSave');
          return next();
        }
  
        // 2. Check if the user still exists in the database
        const userId = decoded.id;
        const query = 'SELECT * FROM users WHERE id = ?';
        db.query(query, [userId], (err, results) => {
          if (err) {
            console.log(err);
            return next();
          }
  
          if (!results || results.length === 0) {
            // User doesn't exist, clear the cookie and continue to the next middleware
            res.clearCookie('userSave');
            return next();
          }
  
          req.user = results[0];
  
          // Proceed to the next middleware
          next();
        });
      } catch (err) {
        console.log(err);
        // Token decoding failed, clear the cookie and continue to the next middleware
        res.clearCookie('userSave');
        return next();
      }
    } else {
      next();
    }
  };
  

  

exports.logout = (req, res) => {
    res.cookie('userSave', 'logout', {
        expires: new Date(Date.now() + 2 * 1000),
        httpOnly: true
    });
    res.status(200).redirect("/");
};
