import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import Joi from "joi";
import { stripHtml } from "string-strip-html";

dotenv.config();
const date = dayjs().format("hh:mm:ss");
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
    let { name } = req.body;
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
        console.log("Error checking user name");
        nameCheck = false;
    }

    name = stripHtml(name).result.trim();

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
            res.status(201).send("Usuário criado com sucesso!");
        } catch {
            console.log("Error adding user");
        }

    }
});

app.get("/participants", (req, res) => {
    db.collection("participants")
        .find()
        .toArray()
        .then(dados => { return res.send(dados) })
        .catch(() => { res.status(500).send("Erro!") });
});


app.post("/messages", async (req, res) => {
    let { to, text, type } = req.body;
    let from = req.headers.user;
    const time = dayjs(Date.now()).format("hh:mm:ss");
    let nameCheck;


    const messageSchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("private_message", "message").required()
    });

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

    to = stripHtml(to).result.trim();
    text = stripHtml(text).result.trim();
    type = stripHtml(type).result.trim();
    from = stripHtml(from).result.trim();

    if (!nameCheck) {
        res.status(422).send("Usuário não encontrado");
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
            res.status(422).send("Limite inválido");
            return;
        }
    }

    const userMessages = messages.filter((message) =>
        message.user === user ||
        message.to === "Todos" ||
        message.from === user ||
        message.to === user ||
        message.type === "status"
    );

    res.send(userMessages.splice(-limit).reverse());

});

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    const time = Date.now();
    const userConnected = await db.collection("participants").findOne({ name: user });
    const participantStatus = { name: user, lastStatus: time };

    if (!userConnected) {
        res.status(404).send("Usuário não encontrado");
        return;
    }


    await db.collection("participants").updateOne({ name: user }, { $set: participantStatus });
    res.status(200).send("Participante atualizado com sucesso");

});

app.delete("/messages/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req.headers;
        const userMessages = await db.collection("messages").findOne({ _id: ObjectId(id) });

        if (!userMessages) {
            res.status(404).send("Mensagem não encontrada, tente novamente");
            return;
        } else if (userMessages.from !== user) {
            res.status(401).send("Esse usuário não é o dono da mensagem, tente outro");
            return;
        }
        await db.collection("messages").deleteOne({ _id: ObjectId(id) });
        res.status(200).send("Mensagem deletada com sucesso");
    } catch {
        res.sendStatus(500);
    }
});

app.put("/messages/:id", async (req, res) => {
    const { id } = req.params;
    const message = req.body;
    const originalMessage = await db.collection("messages").findOne({ _id: ObjectId(id) });
    const { user } = req.headers;
    const userRegistered = await db.collection("participants").findOne({ name: user });

    const messageSchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("private_message", "message").required()
    });

    if (!messageSchema || !userRegistered) {
        res.sendStatus(422);
        return;
    } else if (!originalMessage) {
        res.sendStatus(404);
        return;
    } else if (originalMessage.from !== user) {
        res.status(401).send("Esse usuário não é o dono da mensagem, tente outro");
        return;
    }

    try {
        await db
            .collection("messages")
            .updateOne({ _id: ObjectId(id) }, {$set: message});
        res.status(200).send("Mensagem editada com sucesso");
    } catch {
        res.sendStatus(500);
    }

});

setInterval(
    async function removeInactive() {
        const status = Date.now();
        const time = dayjs(Date.now()).format("hh:mm:ss");
        const findInactive = await db.collection("participants")
            .find({ lastStatus: { $lt: status - 10000 } }).toArray();

        findInactive.forEach(async (user) => {
            await db.collection("participants")
                .deleteOne({ name: user.name });
            await db.collection("messages")
                .insertOne({ from: user.name, to: "Todos", text: "sai da sala...", type: "status", time: time, });
        });
    }
    , 15000);




const PORT = 5000;
app.listen(PORT);