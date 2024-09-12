const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const mongo = require("mongodb").MongoClient;
const {ObjectId} = require("mongodb");

const app = express();
dotenv.config();

var url = process.env.MONGO_DB_URL;

app.set("view engine", "ejs");
app.set("views", "./views");

try{
    app.listen();
    console.log(`Started server at ${process.env.PROTOCOL}://${process.env.HOSTNAME}:${process.env.PORT}`);
}catch(err){
    console.error(err);   
}

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:false,
    cookie:{
        maxAge:1000*60*60*24*15,
    }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

app.get("/", async (req, res) => {
    var post = [];
    if(req.session.isLoggedIn && req.session.user){
        try{
            const client = await mongo.connect(url);
            const db = client.db("devnexus");
            var posts = await db.collection("posts").find();
            for await (const doc of posts){
                post.unshift(doc);
            }
        }catch(err){
            console.error(err);
            res.status(500).redirect("/");
        }
        res.render("index", {session:req.session.user, posts:post});
        console.log(posts);
    }else{
        res.redirect("/login");
    }
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/auth/login", async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    try{
        const client = await mongo.connect(url);
        const db = client.db("devnexus");
        const user = await db.collection("users").findOne({email:email, password:password});

        if(user){
            req.session.isLoggedIn = true;
            req.session.user = user;
            res.redirect("/");
        }
    }catch(err){
        console.error(err);
        res.status(500).redirect("/");
    }
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/auth/signup", async (req, res) => {
    let fname = req.body.fname;
    let lname = req.body.lname;
    let email = req.body.email;
    let password = req.body.password;
    
    let uid = `${fname.replace(" ", "")}${lname.replace(" ", "")}${Math.floor(Math.random()*99999)}@devnexus`;

    try{
        const client = await mongo.connect(url);
        const db = client.db("devnexus");

        let user = {
            uid:uid,
            fname:fname,
            lname:lname,
            email:email,
            password:password,
        }

        const add_user = await db.collection("users").insertOne(user);
        req.session.isLoggedIn = true;
        req.session.user = await db.collection("users").findOne(user);
        console.log("Inserted new user successfully");
        res.redirect("/");

    }catch(err){
        console.error(err);
        res.status(500).redirect("/");
    }
});

app.get("/auth/login", (req, res) => {
    res.redirect("/");
});

app.get("/auth/signup", (req, res) => {
    res.redirect("/");
});

app.get("/logout", (req, res) => {
    try{
        req.session.destroy();
        res.status(200).redirect("/");
    }catch(err){
        console.error(err);
        res.status(500).redirect("/");
    }
});

app.get("/posts/create", (req, res) => {
    if(req.session.isLoggedIn && req.session.user){
        res.render("create_post", {session:req.session});
    }else{
        res.status(440).redirect("/");
    }
});

app.post("/posts/create/:uid", async (req, res) => {
    let uid = req.params.uid;
    let title = req.body.title;
    let content = req.body.content;

    let post = {
        title:title,
        content:content,
        author:uid,
        liked_by:[],
        likes:0,
        comments:[],
    }

    try{
        const client = await mongo.connect(url);
        const db = client.db("devnexus");
        const add_post = await db.collection("posts").insertOne(post);
        res.status(200).redirect("/");
    }catch(err){
        console.error(err);
        res.status(500).redirect("/");
    }
});

app.get("/posts/create_like/:_id", async (req, res) => {
    const post_id = new ObjectId(req.params._id);

    try {
        const client = await mongo.connect(url);
        const db = client.db("devnexus");

        const post = await db.collection("posts").findOne({ _id: post_id });

        if (!post.liked_by.includes(req.session.user.uid)) {
            await db.collection("posts").updateOne(
                { _id: post_id },
                {
                    $push: { liked_by: req.session.user.uid },
                    $inc: { likes: 1 },
                }
            );

            res.status(200).redirect("/");
        } else {

            res.status(400).redirect("/");
        }
    } catch (err) {
        console.error(err);
        res.status(500).redirect("/");
    }
});
