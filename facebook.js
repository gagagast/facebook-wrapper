/* Author  : gaetan 
 * Module : Facebook wrapper
 * Desc : cette object facilite la mise en place du FbConnect et les interactions avec la graph api
 * Dépendance : pubsub de Ben Alman https://gist.github.com/cowboy/661855
 * 
 * A l'instantiation :
 * 1) le sdk se charge en asynchrone
 * 2) une classe est ajouté à la balise 'html' si le sdk est chargé
 * 3) le rendu des plugin XFBML est lancé
 * 4) les events FB connect sont initiés
 * 5) les events de tracking Google Analytics sont initiés
 *
 * Utlisation : myFb = new.Nova.Fb({appID : '13456789'});
 *
 * --PUBSUB--
 * Liste des publish :
 *	- fb/loginSuccess
 *	- fb/logoutSuccess
 *	- fb/friends (+ data)
 *	- fb/infos (+ data)
 *	- fb/messageError
 *	- fb/messageSuccess
 *
 * Liste des subscribe :
 *  - fb/connect
 *  - fb/disconnect
 *
 */



var Nova = Nova || {};

(function($) {


	// Ignore console on platforms where it is not available
	if (typeof(window.console) == "undefined") {
		console = {};
		console.log = console.warn = console.error = function(a) {};
	}

	var defaults = {

	};


	Nova.Fb = (function() {



		//constructeur
		var Fb = function(config) {
			this.params = $.extend({}, defaults, config);
			this.isConnected = false;
			this.userInfo = null;
			this.userFriends = null;
			this.init();
		};



		/*******
		 * Methode statique
		 * Envoi d'un commentaires sur le mur de l'internaute sans boite de dialogue
		 * NB : les balises og de la page seront scannées pour ilustrer le commentaire
		 * @param myMessage {string} le message à envoyer
		 * @param link {string} le lien que facebook doit associer
		 */

		Fb.sendSilentComment = function(myMessage, link) {

			FB.api('/me/feed', 'post', {
				message: myMessage,
				link: link
			}, function(response) {
				console.log(response);
				if (!response || response.error) {
					$.publish('fb/messageError');
				} else {
					$.publish('fb/messageSuccess');
				}
			});

		};


		/*******
		 * Methode statique
		 * Envoi d'un commentaires sur le mur de l'internaute avec boite de dialogue
		 * NB : les balises og de la page seront scannées pour ilustrer le commentaire
		 * @param link {string} le lien que facebook doit associer
		 */

		Fb.sendNoisyComment = function(link) {

			FB.ui({
					method: 'feed',
					link: link
				},
				function(response) {
					if (response && response.post_id) {
						$.publish('fb/messageSuccess');
					} else {
						$.publish('fb/messageError');
					}
				});

		};



		Fb.prototype = {

			constructor: Fb,


			/**
			 * Methode publique
			 * Initialisation de l'application
			 */
			init: function() {
				var that = this;

				//On Facebook ready
				window.fbAsyncInit = function() {

					//ajout des ecouteurs d'events ( connection et comportement)
					that.registerConnectEvents();

					//ajout des ecouteurs d'events (analytics)
					that.registerTrackEvents();


					//Ajout d'une classe sur le  html tag quand Facebook est ready
					$('html').addClass('fb-ready');


					FB.init({
						appId: that.params.appID,
						channelUrl: that.params.channelUrl,
						status: true, // verifie le statut de la connexion
						cookie: true, // active les cookies pour que le serveur puisse accéder à la session
						xfbml: true // active le XFBML (HTML de Facebook)
					});

					//Parse the DOM to instanciate Facebook plugins (Like)
					FB.XFBML.parse();



				};

				this.loadSDK();

			},

			/**
			 * Methode publique
			 * Chargement asynchrone du sdk
			 * @return {[undefined]}
			 */
			loadSDK: function(locale) {

				var defaultLanguage = 'fr_FR',
					async = true,
					localeSDK = (typeof locale != 'undefined') ? locale : defaultLanguage;

				//Load the Facebook SDK JS and add the tag "fb-root"
				(function(d, s, id) {

					var js, tag = document.createElement('div');
					if (d.getElementById(id)) {
						return;
					}
					tag.id = 'fb-root';
					js = d.createElement(s);
					js.id = id;
					js.async = async;
					js.src = "//connect.facebook.net/" + localeSDK + "/all.js";
					d.getElementsByTagName('body')[0].appendChild(tag);
					d.getElementsByTagName('body')[0].appendChild(js);

				}(document, 'script', 'facebook-jssdk'));

			},

			/**
			 * Methode publique
			 * retourne les infos du user connecté
			 * @return {[undefined]}
			 */
			getUserInfo: function() {
				return this.userInfo;
			},


			/**
			 * Methode publique
			 * retourne les amis du user connecté
			 * @return {[undefined]}
			 */
			getUserFriends: function() {
				return this.userFriends;
			},


			/*****
			 * Methode publique
			 * Controle de l'état avec FB
			 * @return {[undefined]}
			 */

			checkState: function() {
				var self = this;
				FB.getLoginStatus(function(response) {

					console.log(response);

					if (response.status === 'connected') {
						self.isConnected = true;
						self.recupUserData(response);
					} else if (response.status === 'not_authorized') {


					} else {

					}
					console.log('facebook App connecté ? : ' + self.isConnected);
				});

			},

			/****
			 * Methode publique
			 * Connection avec FB
			 * permission {string} les permission à demander à l'utilisateur ex: 'email,publish_stream'
			 */

			login: function(permission) {

				var self = this;
				FB.login(function(response) {

					if (response.authResponse) {
						self.recupUserData(response);
						$.publish('fb/loginSuccess');

					} else {
						console.log('connexion ou conditions refusées');

					}
				}, {
					scope: permission
				});

			},

			/*****
			 * Methode publique
			 * Deconnection de l'application facebook
			 */

			logout: function(e) {
				console.log('logout');
				if (this.isConnected) {
					FB.logout(function(response) {
						$.publish('fb/logoutSuccess');
					});
				}

			},

			/******
			 * Methode publique
			 * Récupération des données du compte FB de l'utilisateur selon les permissions
			 */

			recupUserData: function() {
				var that = this;
				FB.api('/me', function(response) {
					that.userInfo = response;
					$.publish('fb/infos', response);
				});
			},

			/******
			 * Methode publique
			 * Récupération des amis de l'utilisateur selon les permissions
			 */

			recupFriendsUser: function() {

				var that = this;
				FB.api("/me/friends", function(response) {
					that.userFriends = response;
					$.publish('fb/friends', response);
				});
			},

			/**
			 * Methode publique
			 * Ecoute des divers evt fb et des solicitation des autres modules ( pubsub)
			 * @return {undefined}
			 */

			registerConnectEvents: function() {
				var that = this;

				//communication avec les autres modules
				$.subscribe('fb/connect', function(e, data) {
					that.login(data.permission);
				});
				$.subscribe('fb/disconnect', function() {
					that.logout();
				});


				//Ecoute du status FB
				FB.Event.subscribe('auth.authResponseChange', function(response) {
					console.log(response);
					if (response.status === 'connected') {
						that.isConnected = true;
						that.recupUserData(response);

					} else if (response.status === 'not_authorized') {

					}
				});

			},

			/**
			 * Methode publique
			 * Ajoutes du traking GA sur les event FB
			 * @return {undefined}
			 */
			registerTrackEvents: function() {

				var targetUrl = document.location.href;

				if (window._gaq) {
					FB.Event.subscribe('edge.create', function(targetUrl) {
						_gaq.push(['_trackSocial', 'facebook', 'like', targetUrl]);
					});
					FB.Event.subscribe('edge.remove', function(targetUrl) {
						_gaq.push(['_trackSocial', 'facebook', 'unlike', targetUrl]);
					});
					FB.Event.subscribe('message.send', function(targetUrl) {
						_gaq.push(['_trackSocial', 'facebook', 'send', targetUrl]);
					});

				}
			}

		};

		// return module
		return Fb;

	})();



}(jQuery));