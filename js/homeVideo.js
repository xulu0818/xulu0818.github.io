(function(root) {
  'use strict';

  root.HomeVideoConstants = {
    NGV_VIDEO_CALL_TIMEOUT: "NGV_VIDEO_CALL_TIMEOUT",
    NGV_REMOTE_HANG_UP: "NGV_REMOTE_HANG_UP",
    NGV_WEB_SOCKET_CONNECTION_ERROR: "NGV_WEB_SOCKET_CONNECTION_ERROR",
    NGV_SET_REMOTE_SDP_ERROR: "NGV_SET_REMOTE_SDP_ERROR",
    NGV_SET_LOCAL_SDP_ERROR: "NGV_SET_LOCAL_SDP_ERROR",
    NGV_CREATE_OFFER_ERROR: "NGV_CREATE_OFFER_ERROR",
    NGV_CREATE_ANSWER_ERROR: "NGV_CREATE_ANSWER_ERROR",
    NGV_CANDIDATE_ERROR: "NGV_CANDIDATE_ERROR",
    NGV_INTERNAL_ERROR: "NGV_INTERNAL_ERROR",
    NGV_STB_JOIN_ROOM_ERROR: "NGV_STB_JOIN_ROOM_ERROR",
    NGV_CAMERA_NOT_IN_ROOM: "NGV_CAMERA_NOT_IN_ROOM",
    NGV_MEDIA_CONNECTION_ERROR: "NGV_MEDIA_CONNECTION_ERROR",
    NGV_DATA_CHANNEL_ERROR: "NGV_DATA_CHANNEL_ERROR",
    NGV_DATA_CHANNEL_CREATE_FAILED: "NGV_DATA_CHANNEL_CREATE_FAILED",
    NGV_DATA_CHANNEL_CLOSED: "NGV_DATA_CHANNEL_CLOSED",
    NGV_SDK_INTERNAL_ERROR: "NGV_SDK_INTERNAL_ERROR",
    NGV_ICE_STATE_DISCONNECTED: "NGV_ICE_STATE_DISCONNECTED",
    NGV_ICE_STATE_CONNECTED: "NGV_ICE_STATE_CONNECTED",
    NGV_START_PLAYER: "NGV_START_PLAYER",
    NGV_STOP_PLAYER: "NGV_STOP_PLAYER",
    NGV_BROWSER_LAUNCHED: "NGV_BROWSER_LAUNCHED",
    NGV_STB_JOINED_ROOM: "NGV_STB_JOINED_ROOM",
    NGV_PC_CREATED: "NGV_PC_CREATED",
    NGV_CHECKING_PEER: "NGV_CHECKING_PEER",
    NGV_WEB_SOCKET_CONNECTION_SUCCESS: "NGV_WEB_SOCKET_CONNECTION_SUCCESS",
    NGV_STB_RECEIVED_OFFER: "NGV_STB_RECEIVED_OFFER",
    NGV_TURN_SERVER_RECEIVED: "NGV_TURN_SERVER_RECEIVED",
    NGV_SEND_ANSWER: "NGV_SEND_ANSWER",
    NGV_INVALID_TOKEN_ERROR: "NGV_INVALID_TOKEN_ERROR",
    NGV_CAM_V6_ENABLED: "NGV_CAM_V6_ENABLED",
    NGV_LIVE_STREAMING_PLAY_STARTED: "NGV_LIVE_STREAMING_PLAY_STARTED",
    NGV_CANDIDATE_DESC: "NGV_CANDIDATE_DESC",
  };

  function HomeVideo(options) {
    //$badger.logger.debug("HomeVideo initialized with : " + JSON.stringify(options));
    this.evoPlayer = new EvoWrtcPlayer(options);
  }

  /*
   * Invoke the playback of the camera stream providing the required info to the evo player
   */
  HomeVideo.prototype.startPlay = function() {
    try {
      this.evoPlayer.registerEventListener((event, description) => {
        this.callbackEvent += event;
        this.handlePlayerCallbackEvents(event, description);
      });
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_START_PLAYER, "triggered play on player");
      this.evoPlayer.play();
      console.log('playing')
    } catch (e) {
      //$badger.logger.error(HomeVideoConstants.X1_SDK_ERROR + " : " + e);
    }
  };

  /*
   * Stop the playback of live video which internally tear downs the peer
   * connection and clear the objects
   */
  HomeVideo.prototype.stopPlay = function() {
    //$badger.logger.info("HomeVideo stopPlay invoked");
    try {
      if (this.evoPlayer) {
        //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_STOP_PLAYER, "triggered stop on player");
        this.evoPlayer.stop();
        this.evoPlayer = null;
        return;
      }
    } catch (e) {
      //$badger.logger.error(HomeVideoConstants.X1_SDK_ERROR + " : " + e);
    }
  };

  /*
   * Callback for events emitted from EVOWRTC/EVOFMP4 players
   */
  HomeVideo.prototype.handlePlayerCallbackEvents = function(event, description) {
    console.log(" handlePlayerCallbackEvents :  event : " + event + " - description : " + description);
    switch (event) {
    case 'connectionfailedpeer':
      //$badger.errorMetricsHandler(event, false, HomeVideoConstants.NGV_MEDIA_CONNECTION_ERROR, null);
      break;
    case 'disconnectedpeer':
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_ICE_STATE_DISCONNECTED, "Media connection disconnected");
      break;
    case 'channelopen':
      //$badger.logger.info(" data channel opened : " + description);
      break;
    case 'channelclosed':
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_DATA_CHANNEL_CLOSED, description);
      break;
    case 'channelerror':
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_DATA_CHANNEL_ERROR, description);
      break;
    case 'joinedroom':
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_STB_JOINED_ROOM, "joined room from stb");
      break;
    case 'createdpeer':
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_PC_CREATED, "Peer Connection created");
      break;
    case 'connectedpeer':
      //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_ICE_STATE_CONNECTED, "Media connection established");
      //$badger.logger.info(" Peer Id for Connected ICE " + description);
      break;
    case 'chosencandtype':
       //$badger.logger.info("Candidate type chosen : " + description);
       break;
    case 'connectionready':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_WEB_SOCKET_CONNECTION_SUCCESS, "WebSocket connection established");
       break;
    case 'connect_error':
    case 'socket_error':
    case 'connect_timeout':
    case 'connect_failed':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_WEB_SOCKET_CONNECTION_ERROR, description);
       break;
    case 'socket_disconnected':
       //$badger.logger.info("Websocket got disconnected " + description);
       break;
    case 'socket_reconnect':
       //$badger.logger.info("WebSocket got reconnected: " + description);
       break;
    case 'joinerror':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_STB_JOIN_ROOM_ERROR, "Error while joining the room  : "+description);
       break;

    case 'camerajoinerror':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_CAMERA_NOT_IN_ROOM, "Camera not in the room  : "+description);
       break;
    case 'camv6enabled':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_CAM_V6_ENABLED, description);
       break;

    case 'receivedOffer':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_STB_RECEIVED_OFFER, "STB received the offer ");
       break;
    case 'checkingpeer':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_CHECKING_PEER, "STB checking peer ");
       break;
    case 'turnservers':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_TURN_SERVER_RECEIVED, description);
       break;
    case 'sendanswer':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_SEND_ANSWER, description);
       break;
    case 'invalidtoken':
       //$badger.appActionMetricsHandler(HomeVideoConstants.NGV_INVALID_TOKEN_ERROR, description);
       break;
    case 'playing':
       ///$badger.appActionMetricsHandler(HomeVideoConstants.NGV_LIVE_STREAMING_PLAY_STARTED, description);
       break;
    case 'localSrflx':
    case 'localRelay':
    case 'localHost':
        //$badger.logger.info(HomeVideoConstants.NGV_CANDIDATE_DESC + "_LOCAL: " + description);
        break;
    case 'remoteSrflx':
    case 'remoteRelay':
    case 'remoteHost':
        //$badger.logger.info(HomeVideoConstants.NGV_CANDIDATE_DESC + "_REMOTE: " + description);
        break;
    // FMP4 player events - X1 don't require it now
    case 'playerfroze':
    case 'playerstopped':
    case 'playerstarted':
      break;
    default:
      break;
    }
  };

  root.HomeVideo = HomeVideo;

})(window);
