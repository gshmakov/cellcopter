
/*	
		
		Author: Gennady Shmakov <gshmakov@gmail.com>
		Copyright (c) 2015 Gennady Shmakov. All rights reserved. 
		
		INFO:
		Server uses single UDP socket for both camera and data
		Works with cellcopter.html file
		Possible issues - all processing is done on client side -> may be slow

*/

var ServerIP="0.0.0.0";
var WebSocketServerPort=8800;
var UDPSocketPort=2200;


var dgram=require('dgram');
var UDPserver=null;
var UDPremoteIP=null, UDPremotePort=null;


var hb=1;

var wsClient=null;
var WebSocketServer=require('ws').Server;


// =========== WebSocket section ==================
var wss=new WebSocketServer({host:ServerIP, port:WebSocketServerPort, verifyClient:WSVC}, function() {console.log('WS listen on: '+wss.options.host+':'+wss.options.port);});
wss.on('connection', wssOnConnection);

function WSVC(info) { //Check if another connection already exists
	if (wsClient!=null) {
		console.log('Websocket Already connected');
		return false;
	} else {return true;}
}

function wssOnConnection(ws) {
	wsClient=ws;
	console.log('\nClient connected from IP:'+wsClient.upgradeReq.connection.remoteAddress);
	
	wsClient.on('message', wsClientOnMessage);
	wsClient.on('close', wsClientOnClose);
}

function wsClientOnMessage(data) { //Data received on websocket
	switch(data) {
			
		case 'runUDP': //Init. Start listening on UDP
			UDPStart();
		break;
		
		default: //If already connected, then transmit data on UDP
			if ((UDPremoteIP!=null)&&(UDPremotePort!=null)) {
				var tempMSG=new Buffer(data);
				UDPserver.send(tempMSG,0,tempMSG.length,UDPremotePort,UDPremoteIP);
				//console.log('->device:'+tempMSG);
			}
		break;
	}
}

function wsClientOnClose() {
	console.log('Client disconnected');
	wsClient=null;
	if (UDPserver!=null) {
		UDPserver.close();
		UDPserver=null;
	}
	UDPremoteIP=null;
	UDPremotePort=null;
}
// =========== WebSocket section END ==============


// =========== UDP section ==================
function UDPStart() {
	UDPserver=dgram.createSocket("udp4");
	
	UDPserver.on('listening', function() {
		var UDPaddr=UDPserver.address();
		var tempMsg="2i_INFO:UDP listening on "+UDPaddr.address+":"+UDPaddr.port;
		console.log(tempMsg);
		wsClient.send(tempMsg);
	});
	
	UDPserver.on('message', function(msg, rinfo) {
		
		if ((UDPremoteIP==null)||(UDPremotePort==null)) {
			UDPremoteIP=rinfo.address;
			UDPremotePort=rinfo.port;
			var infoMsg="2i_INFO:Client connected "+UDPremoteIP+":"+UDPremotePort;
			console.log(infoMsg);
			wsClient.send(infoMsg);
		}
		
		if ((msg.slice(0,3)=="2i_") || (msg==";GSHFrame")) {
			wsClient.send(msg,{binary:false});
			if (msg=="2i_hb;GSH") {hb=1;}
		} else {
			wsClient.send(msg,{binary:true});
		}
		
	});
	
	UDPserver.on('error', function(err) {
		console.log("server error:\n"+err.stack);
		UDPserver.close();
	});
	
	UDPserver.on('close', function() {
		console.log("UDPserver closed");
	});
	
	UDPserver.bind(UDPSocketPort, ServerIP);
}
// =========== UDP section END ==============


setInterval(function() { //check for heartbeat from device. if no -> remove this peer
  if (UDPremoteIP!=null) {
		if (hb==1) {
			hb=0;
		} else {
			console.log("HB failed. Device "+UDPremoteIP+":"+UDPremotePort+" removed");
			UDPremoteIP=null;
			UDPremotePort=null;
		}
	}
}, 6000);
