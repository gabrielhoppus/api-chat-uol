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
    })

    const nameValidation = nameSchema.validate({name})

    if (nameValidation){
        res.status(422).send("Insira um nome válido.")
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
    } else {
        try{
            const participant = { name, lastStatus: Date.now() };
            await db.collection("participants").insertOne(participant);
        } catch {
            console.log("Error adding user")
        }
        res.status(201).send("Participante adicionado com sucesso")
    }
})

//get participants
app.get("/participants", (req, res) => {
    db.collection("participants").find().toArray().then(dados => { return res.send(dados) }).catch(() => { res.status(500).send("Erro!") });
})




// //get messages
// db.collection("messages").find().toArray().then();

// //post messages
// const { } = req.body
// db.collection("messages").insertOne({

// }).then(() => {
//     res.status(201);
// }).catch(() => {
//     res.status(401);
// })



const PORT = 5000;
app.listen(PORT);