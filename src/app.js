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


app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const time = dayjs(Date.now()).format("hh:mm:ss");
    let nameCheck;


    const messageSchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("private_message", "message").required()
    })

    const messageValidation = messageSchema.validate({ to, text, type });

    if (messageValidation.error) {
        res.status(422).send(messageValidation.error.details);
        return;
    }

    try {
        nameCheck = await db.collection("participants").findOne({ name: from })
    } catch {
        console.log("Error checking user name");
        nameCheck = false;
    }

    if (!nameCheck) {
        res.status(422).send("Usuário não encontrado")
        return;
    }

    try {
        await db.collection("messages").insertOne({
            to,
            text,
            type,
            from,
            time,
        });
        res.status(201).send("Mensagem enviada");
    } catch {
        res.status(422).send("Send Message Error");
    }
});


app.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const messages = await db.collection("messages").find().toArray();
    let limit;

    if (req.query.limit) {
        limit = parseInt(req.query.limit);
        if (limit < 1 || isNaN(limit)) {
            res.status(422).send("Limite inválido")
            return;
        }
    }

    let userMessages = messages.filter((message) =>
        message.user === user ||
        message.to === "Todos" ||
        message.from === user ||
        message.to === user ||
        message.type === "status"
    );

    res.send(userMessages.splice(-limit).reverse())

})

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    const time = Date.now();
    const userConnected = await db.collection("participants").findOne({ name: user });
    const participantStatus = { name: user, lastStatus: time };

    if (!userConnected) {
        res.status(404).send("Usuário não encontrado");
        return;
    }


    await db.collection("participants").updateOne({ name: user }, { $set: participantStatus })
    res.status(200).send("Participante atualizado com sucesso")

})


// setInterval(
//     async function removeInactive() {
//         const status = Date.now();
//         const time = dayjs(Date.now()).format("hh:mm:ss");
//         const findInactive = await db.collection("participants").find({ lastStatus: { $lt: status - 10000 } })
//     }

//     , 15000)




const PORT = 5000;
app.listen(PORT);