var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var redis = require('redis');
var _ = require('underscore-node');

var app = express();

// Cria Cliente Redis
// Porta e hostname são retirados de configuration -> endpoint do redislabs.com
var clienteRedis = redis.createClient(6379, 
	'127.0.0.1', 
	{no_ready_check: true});

clienteRedis.auth('password', function(err){
	if (err) throw err;
});

clienteRedis.on('connect', function () {
    console.log('Servidor Redis Conectado ...');
});

// Configuração do Renderizador de Páginas (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function Charity(cod, nam, val){
	this.codigo = cod;
	this.name = nam;
	this.value = val;
}

var renderCharity = function(res, charitys, titulo){
	return function(){
		res.render('charity', {
			charitys : charitys,
			titulo : titulo
		});	
	};
};

// Captura o caminho '/' na URL
app.get('/', function (req, res) {
    var titulo = 'Doações';
	var charitys = []
    
    clienteRedis.smembers('codigos', function (err, codigos) {
		console.info('info oos')
		var afterAll = _.after((codigos.length), renderCharity(res, charitys, titulo))
		
		for(var i in codigos){
			clienteRedis.hgetall('charity:'+codigos[i], function(err, obj){
				var charity = new Charity(obj['codigo'], obj['name'], obj['value'])
				charitys.push(charity)
				afterAll();
			});
		}
		if(codigos.length==0)
			afterAll();
		
	}) 
});

var thisIsCharityOhOh = function(value){
	return value + Math.floor((Math.random() *(60-10)+10));
}

app.post('/charity/adicionar', function(req, res){
	var charity = {}
	
	charity.codigo = req.body.charity.codigo;
	charity.value = thisIsCharityOhOh(req.body.charity.value);
	charity.name = req.body.charity.name;

	var obj = ["codigo", charity.codigo, "name", charity.name, "value", charity.value]
	clienteRedis.hmset('charity:'+charity.codigo , obj, function(err, reply){
		if(err){ 
			console.log(err);
		}
		console.log('Charity [' + charity.codigo + '] adicionado');
		clienteRedis.sadd("codigos", charity.codigo, function (err, reply) {
			if(err){
				console.log(err);
			}
			console.log('Codigo adicionado ...');
			res.redirect('/');
		}); 
	});

});

app.post('/charity/remover', function(req, res){
	var charityToRemove = req.body.codigo;
	
	clienteRedis.srem('codigos', charityToRemove, function(){
		clienteRedis.del("charity:"+charityToRemove, function(){
			console.info('apagando....')
			res.redirect("/")
		});
	});
});

app.post('/charity/editar', function(req, res){
	var charity = {};

	charity.codigo = req.body.charity.codigo;
	charity.value = req.body.charity.value;
	charity.name = req.body.charity.name;

	clienteRedis.hmset('charity:'+charity.codigo, 
	         ['name', charity.name, 
			  'value', thisIsCharityOhOh(charity.value)], 
			  function(err, reply){
		if(err){
			console.log(err);
		}
		console.log(reply);
		res.redirect('/');
	});
});

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'), function() {
	console.log('Servidor Inicializado na Porta', app.get('port'));
  });

module.exports = app;