import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();
const date = dayjs().format("hh:mm:ss")
const app = express();
app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.DATABASE_URL);
let db;

client.connect()
    .then(() => {
        db = client.db();
        console.log("Sucesso");
    })
    .catch((err) => {
        console.log(err);
    });


app.post("/participants", async (req, res) => {
    const { name } = req.body;
    let nameCheck;

    const nameSchema = Joi.object({
        name: Joi.string().required()
    });

    const nameValidation = nameSchema.validate({ name });

    if (nameValidation.error) {
        res.status(422).send(nameValidation.error.details);
        return;
    }

    try {
        nameCheck = await db.collection("participants").findOne({ name });
    } catch {
        console.log("Error checking user name")
        nameCheck = false;
    }

    if (nameCheck) {
        res.status(409).send("Esse usuário já está cadastrado, tente outro nome.");
        return;
    } else {
        try {
            const participant = { name, lastStatus: Date.now() };
            await db.collection("participants").insertOne(participant);
            await db.collection("messages").insertOne({
                from: name,
                to: "Todos",
                text: "entra na sala...",
                type: "status",
                time: date,
            });
            res.status(201).send("Usuário criado com sucesso!")
        } catch {
            console.log("Error adding user")
        }
        
    }
})

//get participants
app.get("/participants", (req, res) => {
    db.collection("participants").find().toArray().then(dados => { return res.send(dados) }).catch(() => { res.status(500).send("Erro!") });
})

//post messages
app.post("/messages", (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const time = dayjs(Date.now()).format("hh:mm:ss");


    const messageSchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("private_message", "message").required()
    })


    db.collection("messages").insertOne({

    }).then(() => {
        res.status(201);
    }).catch(() => {
        res.status(401);
    })
})




// //get messages
// db.collection("messages").find().toArray().then();







const PORT = 5000;
app.listen(PORT);