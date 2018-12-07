//import { MongoClient as mongo } from 'mongodb';
const mongo = require('mongodb').MongoClient;
const io = require('socket.io').listen(4000).sockets;

const assert = require('assert');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'mongochatsessions';
// collection Name
const colcName = 'chatsessions'

// format for collection
//var chatSession = { name: string, members: [name:stirng], chats: {name:string, message: string} };

//Connect to mongo
mongo.connect(url, function (err, client) {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);

    io.on('connection', function (socket) {
        let sessions = db.collection(colcName);
        console.log("Ay blyat got the client on this side!");

        sessionTime = 15*60;

        // Helper Functions
        sendStatus = function (s) {
            socket.emit('status', s);
        }
        // Timer funct
        startTimer = function(chatroomame, duration) {
            timer = duration;
            minutes = 0;
            seconds = 0;
            Tclear = setInterval(function () {
                minutes = parseInt(timer / 60, 10)
                seconds = parseInt(timer % 60, 10);

                // update database here
                temptime = minutes*60 + seconds;
                sessions.update({ name: chatroomame }, {$set: {time: temptime} },function () {
                    roomTimer = {name: chatroomame, min: minutes, sec:seconds};
                    io.emit("update-timer", roomTimer);
                });
                // clearly oversight in design
                sessions.update({ name: chatroomame }, {$set: {clear: Tclear} },function () {
                });

                minutes = minutes < 10 ? "0" + minutes : minutes;
                seconds = seconds < 10 ? "0" + seconds : seconds;
                console.log(minutes + ":" + seconds);
                
                if (--timer < 0) {
                    // send message to users to block chat room
                    sessions.update({ name: chatroomame }, {$set: {time: temptime} },function () {
                        io.emit("session-end", chatroomame);
                        clearInterval(Tclear);
                    });
                }                
            }, 1000);
        }

        socket.on('start-timer', function(roomname){
            sessions.find({name: roomname}).toArray(function (err, res) {
                if (err) {
                    throw err;
                }
                if(res.length <= 0){
                    console.log("FRANKLY THIS SHOULDNT HAPPEN MAYBE I SEND STATUS IN FUTURE ee" );
                }  else {
                    var duration = res[0].time;
                    console.log("time:" + duration);
                    startTimer(roomname, duration);
                }
            });
        });
        socket.on('stop-timer', function(roomname){
            sessions.find({name: roomname}).toArray(function (err, res) {
                if (err) {
                    throw err;
                }
                if(res.length <= 0){
                    console.log("FRANKLY THIS SHOULDNT HAPPEN MAYBE I SEND STATUS IN FUTURE" );
                }  else {
                    clear = res[0].clear;
                    console.log("clear:" + clear);
                    clearInterval(clear);
                }
            });
        });

        socket.on('searchroom', function (data) {
            // emits the the new updated record
            emitLatest =  function() {
                sessions.find({name: data.roomname}).toArray(function (err, res) {
                    if (err) {
                        throw err;
                    }
                    io.emit('foundroom', res);
                });
            }
            sessions.find({name: data.roomname}).toArray(function (err, res) {
                if (err) {
                    throw err;
                }
                if(res.length <= 0){
                    console.log("Came to insert:" + data.roomname);
                    sessions.insert({name:data.roomname, members:[{name:data.name}], chats: [], time: sessionTime, clear:''}, function (err, res) {
                        emitLatest();
                        startTimer(data.roomname, sessionTime);
                    });
                    
                } else  if(!res[0].members.find(o => o.name === data.name)){
                    console.log("Came to update:" + data.name);
                    sessions.update({ name: data.roomname }, {$addToSet: {members: {name:data.name}}} ,function () {
                        emitLatest();
                    });
                } else {
                    console.log("FOUND RES dasd:" + res[0].name);
                    socket.emit('foundroom', res);
                }
            });
        });

        socket.on('userlogin', function (data) {
            sessions.find().toArray(function (err, res) {
                if (err) {
                    throw err;
                }
                //Emmit messages
                socket.emit('userlogged', res);
            });
        });

        //Hande input events
        socket.on('chatinput', function (data) {
            let chatroomname = data.chatroomname; // maybe i should do this with mongo's id
            let name = data.name;
            let message = data.message;

            // Check for name and message
            if (name == '' || message == '') {
                console.log(data);
                // send error status
                // sendStatus('Please enter a name and a message');
            } else {
                // Insert message
                sessions.update({ name: chatroomname }, {$addToSet: {chats: {name:name, message:message}}} ,function () {
                    io.emit('output', [data]);
                    // Send status to client
                    // sendStatus({
                    //     message: 'Message sent',
                    // });
                });
            }
        });
    });


});