require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(express.static("public"));

// Tell app to use session package  and setting it up
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
  })
);

// Initialize passport package
app.use(passport.initialize());
// Allowing passport to manage our session
app.use(passport.session());

//Mongoose Connection
mongoose.connect(
  "mongodb+srv://admin0:" +
    process.env.ATLAS_ADMIN_PASSWORD +
    "@cluster0-imurw.mongodb.net/parrotDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
);
mongoose.set("useCreateIndex", true);

//Schemas
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

const secretSchema = new mongoose.Schema({
  user: String,
  content: String,
  likes_count: Number
});

// Add plugins to User Schema
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Mongoose Models
const User = new mongoose.model("User", userSchema);

const Secret = new mongoose.model("Secret", secretSchema);

// Creating user strategy
passport.use(User.createStrategy());

// Serialise is creating the cookie
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "https://parrotsecrets.herokuapp.com/auth/facebook/secrets",
      profileFields: [
        "id",
        "displayName",
        "name",
        "gender",
        "picture.type(large)"
      ]
    },
    function(accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ username: profile.displayName }, function(err, user) {
        return cb(err, user);
      });
    }
  )
);

// Facebook OAuth Page
app.get("/auth/facebook", passport.authenticate("facebook"));
// Facebook Callback Url
app.get(
  "/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);

// Register Page
app.get("/register", function(req, res) {
  res.render("register", { error: "" });
});

app.post("/register", (req, res) => {
  // PassportLocalMongoose Method Register
  User.register({ username: req.body.username }, req.body.password, function(
    err,
    user
  ) {
    if (err) {
      console.log("ask to register");
      console.log(err.message);
      res.render("register", { error: err.message });
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

// Login Page
app.get("/", function(req, res) {
  res.redirect("/secrets");
});

app.get("/login", function(req, res) {
  res.render("login", { isErr: false });
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  // Passport Method login
  req.login(user, function(err) {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else if (!user) {
      console.log("something");
      done(null, null);
    } else {
      console.log("ready to auth");
      passport.authenticate("local", {
        successRedirect: "/secrets",
        failureRedirect: "/login"
      })(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});

// Secrets Page
app.get("/secrets", function(req, res) {
  if (req.isAuthenticated()) {
    Secret.find({ content: { $ne: null } }, (err, foundSecrets) => {
      if (err) {
        console.log(err);
      } else {
        if (foundSecrets) {
          res.render("secrets", {
            isAuth: true,
            showSecrets: foundSecrets
          });
        }
      }
    }).sort({ likes_count: "desc" });
  } else {
    // Get the count of all users
    Secret.count().exec(function(err, count) {
      // Get a random entry
      const random = Math.floor(Math.random() * count);

      const notAuthQuery = Secret.find({ content: { $ne: null } }).limit(5);
      notAuthQuery.skip(random).exec((err, notAuthSecrets) => {
        if (err) {
          console.log(err);
        } else {
          if (notAuthSecrets) {
            res.render("secrets", {
              isAuth: false,
              showSecrets: notAuthSecrets
            });
          }
        }
      });
    });
  }
});

app.post("/secrets", (req, res) => {
  let cardId = req.body.cardId;
  let dislikeBtn = req.body.dislikeBtn;
  let likeBtn = req.body.likeBtn;

  if (likeBtn) {
    Secret.findByIdAndUpdate(
      cardId,
      { $inc: { likes_count: 1 } },
      { new: true },
      (err, updatedLike) => {
        if (err) {
          console.log(err);
        } else {
          res.redirect("/secrets");
        }
      }
    );
  } else if (dislikeBtn) {
    Secret.findByIdAndUpdate(
      cardId,
      { $inc: { likes_count: -1 } },
      { new: true },
      (err, updatedLike) => {
        if (err) {
          console.log(err);
        } else {
          console.log(updatedLike);
          res.redirect("/secrets");
        }
      }
    );
  }
});

// Submit Page
app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit", {
      user: req.user.username
    });
  } else {
    res.redirect("/");
  }
});

app.post("/submit", (req, res) => {
  // Create New Secret
  const submittedSecret = new Secret({
    user: req.user.username,
    content: req.body.secret,
    likes_count: 0
  });
  submittedSecret.save(err => {
    if (!err) {
      console.log(" Secret saved: " + submittedSecret);
      res.redirect("/");
    }
  });
});

// User Page
app.get("/user", function(req, res) {
  if (req.isAuthenticated()) {
    Secret.find(
      { user: req.user.username, content: { $ne: null } },
      (err, mySecrets) => {
        if (err) {
          console.log(err);
        } else {
          if (mySecrets) {
            res.render("user", {
              user: req.user.username,
              userId: req.user.id,
              showMySecrets: mySecrets
            });
          }
        }
      }
    );
  } else {
    res.redirect("/");
  }
});
// Removing secrets
app.get("/delete/:secretId", (req, res) => {
  const secretId = req.params.secretId;
  // Removing Secret
  Secret.findByIdAndRemove(secretId, err => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/user");
    }
  });
});

// Deleting Account
app.get("/user/:userId", (req, res) => {
  const deletedUserId = req.params.userId;
  console.log(deletedUserId);

  // Removing User
  User.findByIdAndRemove(deletedUserId, err => {
    if (err) {
      console.log(err);
      console.log("FindByID not working");
    } else {
      console.log("here: " + deletedUserId);
      res.redirect("/user");
    }
  });
});

const port = process.env.PORT || 3000;

app.listen(port, function() {
  console.log("Server started on port 3000");
});
