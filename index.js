const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
const mongoURI = "mongodb+srv://tryz:tryz1812@sldr.ors6dui.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(mongoURI);

const saveMessage = async (mes, username) => {
    const db = client.db("chatApp");
    const allLog = await db
        .collection("chatLog")
        .find({}, { projection: { _id: 0 } })
        .toArray();

    const chatLog = allLog.filter((l) => l.receivers.includes(mes.destination) && l.receivers.includes(username))[0];

    if (chatLog === undefined) {
        // await db.collection("chatLog").insertOne({
        //     receivers: [username, mes.destination],
        //     chatLog: [
        //         {
        //             sender: username,
        //             message: mes.message,
        //             imageBase64: mes.image,
        //         },
        //     ],
        // });
    } else {
        await db.collection("chatLog").updateOne(
            { receivers: chatLog.receivers },
            {
                $set: {
                    chatLog: [
                        ...chatLog.chatLog,
                        {
                            sender: username,
                            message: mes.message,
                            imageBase64: mes.image,
                        },
                    ],
                },
            },
        );
    }

    return { res: 200 };
};

const getUserAddress = async (name, username) => {
    const db = client.db("chatApp");
    const userAddress = await db.collection("address").findOne({ username: name }, { projection: { _id: 0 } });
    const allLog = await db
        .collection("chatLog")
        .find({}, { projection: { _id: 0 } })
        .toArray();

    console.log(userAddress);
    if (!userAddress) {
        return { err: 0 };
    }

    if (allLog.filter((l) => l.receivers.includes(name) && l.receivers.includes(username)).length === 0) {
        await db.collection("chatLog").insertOne({ receivers: [username, name], chatLog: [] });
        await db.collection("friendsList").updateOne({ username: username }, { $push: { friendsList: name } });
        await db.collection("friendsList").updateOne({ username: name }, { $push: { friendsList: username } });
        return { ...userAddress, chatLog: [] };
    }

    const chatLog = allLog.filter((l) => l.receivers.includes(name) && l.receivers.includes(username))[0];
    return { ...userAddress, chatLog: chatLog.chatLog };
};

const setOffline = async (uname) => {
    const db = client.db("chatApp");
    await db.collection("address").updateOne({ username: uname }, { $set: { status: "offline" } });

    return { res: 200 };
};

const returnUserData = async (uname, pwd, ip, port) => {
    const db = client.db("chatApp");
    const checkUsername = await db
        .collection("authenticationInfo")
        .find(
            {
                username: uname,
            },
            { projection: { _id: 0 } },
        )
        .toArray();

    if (checkUsername.length !== 0) {
        const queries = await db
            .collection("authenticationInfo")
            .find({
                username: uname,
                password: pwd,
            })
            .toArray();

        if (queries.length !== 0) {
            const friendsList = await db
                .collection("friendsList")
                .findOne({ username: uname }, { projection: { _id: 0 } });
            await db
                .collection("address")
                .updateOne({ username: uname }, { $set: { ipAddress: ip, port: port, status: "online" } });
            return {
                auth: 1,
                ...friendsList,
            };
        } else {
            return { auth: 0 };
        }
    } else {
        db.collection("authenticationInfo").insertOne({ username: uname, password: pwd });
        db.collection("address").insertOne({ username: uname, ipAddress: ip, port: port, status: "online" });
        db.collection("friendsList").insertOne({ username: uname, friendsList: [] });
        return { auth: -1, username: uname, friendsList: [] };
    }
};

app.use(express.json());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", true);
    res.header("crossdomain", true);
    next();
});

app.post("/authenticate", async (req, res) => {
    const authInfo = await returnUserData(req.body.userName, req.body.pwd, req.body.ip, req.body.port);
    res.json(authInfo);
    // console.log(authInfo);
});

app.post("/closeSignaling", async (req, res) => {
    const resFromServer = await setOffline(req.body.uname);
    res.json(resFromServer);
});

app.post("/getUserAddress", async (req, res) => {
    const userAddress = await getUserAddress(req.body.name, req.body.username);
    res.json(userAddress);
});

app.post("/saveMessage", async (req, res) => {
    const response = await saveMessage(req.body.mes, req.body.username);
    res.json(response);
});

app.listen(60727, async () => {
    try {
        await client.connect();
        console.log("Working at " + 60727);
    } catch (e) {
        console.error(e);
    }
});
