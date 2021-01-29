/**
 * The $badger (or Money Badger) library provides JavaScript access to commonly used actions on a STB. It is bringing
 * the Future of Awesome (TM) to you right now!
 *
 * @constructor
 * @namespace
 *
 * @author Clark Malmgren
 */
$badger = (function () {
    /* Public */
    var pub = {};

    /* Private */
    var pri = {
        pid_last: 0,
        promises: {}
    };

    var MONEY_BADGER_LOADED_EVENT_NAME = "onMoneyBadgerReady";

    /* Find the Bridge Object */
    if (typeof ServiceManager != 'undefined' && ServiceManager != null) {
    	if ('version' in ServiceManager) {
    		/** WPE */
    		ServiceManager.getServiceForJavaScript("com.comcast.BridgeObject_1", function(service) {
                pri.bridge = service;
                //Emit event
                setTimeout(function() {
                    pub.logMoneyBadgerLoaded();
                    pub.fireDocumentEvent(MONEY_BADGER_LOADED_EVENT_NAME);
                }, 0);
            });
    	} else {
    		/** QT */
            var createService = ServiceManager.createService || ServiceManager.getServiceForJavaScript;
            pri.bridge = createService('com.comcast.BridgeObject_1');
            if (pri.bridge == null) {
            	pri.bridge = createService('com.comcast.BridgeObj1');
            }
            //Emit event
            setTimeout(function() {
                pub.logMoneyBadgerLoaded();
                pub.fireDocumentEvent(MONEY_BADGER_LOADED_EVENT_NAME);
            }, 0);
    	}
    } else {
        //Emit event
        setTimeout(function() {
            pub.logMoneyBadgerLoaded();
            pub.fireDocumentEvent(MONEY_BADGER_LOADED_EVENT_NAME);
        }, 0);
    }

    /**
     * Exception method if we don't have JSON.parse available in the browser.
     *
     * @throws string
     */
    pri.noJsonException = function() {
        throw "Browser does not support JSON, developer must use a library based alternative";
    };

    /**
     * The configurable method to convert to JSON. This will default to JSON.stringify if it exists,
     * otherwise it will use the pri.noJsonException method.
     *
     * @type {Function}
     */
    pri.toJson = (JSON && JSON.parse) ? JSON.stringify : pri.noJsonException;

    /**
     * The configurable method to convert from JSON. This will default to JSON.parse if it exists,
     * otherwise it will use the pri.noJsonException method.
     *
     * @type {Function}
     */
    pri.fromJson = (JSON && JSON.stringify) ? JSON.parse : pri.noJsonException;

    /**
     * The xscd string
     *
     * @type {Object}
     */
    pri.xscd = null;

    /**
     * The xscd expiry
     *
     * @type {Object}
     */
    pri.xscd_expiry = null;

    /** Wraps a promise object so that some other code can be executed between when the call returns and what
     * the user sets as the callback. This can also modify the arguments from what the API returned
     */
    pri.wrapPromise = function(promise, success, failure, timeout) {
        var p = {
            success: function(fn) {
                promise.success(function() {
                    var newArgs = arguments;
                    if (success) newArgs = success.apply(null, arguments);
                    fn.apply(null, Array.isArray(newArgs) ? newArgs : [newArgs]);
                })
                return p;
            },
            failure: function(fn) {
                promise.failure(function() {
                    var newArgs = arguments;
                    if (failure) newArgs = failure.apply(null, arguments);
                    fn.apply(null, Array.isArray(newArgs) ? newArgs : [newArgs]);
                })
                return p;
            },
            timeout: function(fn) {
                promise.timeout(function() {
                    var newArgs = arguments;
                    if (timeout) newArgs = timeout.apply(null, arguments);
                    fn.apply(null, Array.isArray(newArgs) ? newArgs : [newArgs]);
                })
                return p;
            }
        }
        return p;
    }

    /**
     * Constructs a new $badger promise to handle an asynchronous response from the XRE namespace.
     *
     * @constructor
     *
     * @param [success] {function} the code to invoke on success
     * @param [failure] {function} the code to invoke on failure
     *
     * @returns $badger.promise
     */
    pub.promise = function (success, failure) {
        /**
         * The methods to invoke on callback. They are not inserted into the promise to isolate concerns.
         *
         * @type {{success: function, failure: function}}
         */
        var handlers = {
            success: success,
            failure: failure,

            /**
             * Cancel the timeout.
             */
            cancelTimeout: function() {
                if (handlers.timeout) {
                    window.clearTimeout(handlers.timeout);
                }
            }
        };

        /**
         * The promise that gets returned back to the caller on which they can do callback chaining
         * if they didn't pass their callbacks as arguments.
         *
         * @type {{pid: number, success: Function, failure: Function}}
         */
        var p = {
            /**
             * The pid (Promise ID) is used to identify and
             */
            pid: (++pri.pid_last),

            /**
             * Add the code function to be called when successful.
             *
             * @param code {function} the function to invoke on success
             * @returns {$badger.promise} this promise
             */
            success: function (code) {
                handlers.success = code;
                return p;
            },

            /**
             * Add the code function to be called when a failure occurs.
             *
             * @param code {function} the function to invoke on failure
             * @returns {$badger.promise} this promise
             */
            failure: function (code) {
                handlers.failure = code;
                return p;
            },

            /**
             * Add a timeout that will get called if Chariot does not respond to the promise in a meaningful time.
             * If either the success or failure methods are invoked, the timeout function will be canceled. If the
             * timeout function is invoked, the promise is considered unresolvable and the success and failure will
             * not ever be called even if Chariot finally sends a response.
             *
             * @param code {function} the function to invoke on timeout
             * @param delay {number} the delay in millis to wait before invoking the timeout
             * @returns {$badger.promise} this promise
             */
            timeout: function(code, delay) {
                /* Set the timeout Handler */
                handlers.timeout = window.setTimeout(function() {
                    /* Remove the promise from the map making it unresolvable and then call the code */
                    delete pri.promises[p.pid];
                    code();
                }, delay);

                return p;
            },

            /**
             * Add the existing failure method as the method that will be invoked on timeout if Chariot does not
             * respond to the promise in a meaningful time. If either the success or failure methods are invoked,
             * the timeout function will be canceled. If the timeout function is invoked, the promise is considered
             * unresolvable and the success and failure will not ever be called even if Chariot finally sends a response.
             *
             * @param delay {number} the delay in millis to wait before invoking the timeout
             * @returns {$badger.promise} this promise
             */
            timeoutAsFailure: function(delay) {
                return p.timeout(handlers.failure, delay);
            }
        };
        pri.promises[p.pid] = handlers;

        return p;
    };

    /**
     * Sends a raw message to the XRE environment using the Bridge Object. Do not use this method unless you are
     * sure you know what you are doing.
     *
     * @param action {string} the action
     * @param [args] {{}} the arguments to that action
     * @param [pid] {number} the callback pid (promise ID) if one exists
     */
    pub.send = function (action, args, pid) {
        var msg = pri.toJson({ action: action, args: args, pid: pid });

        if (pri.bridge) {
            pri.bridge.JSMessageChanged(msg, () => {});
        } else if (pid) {
            window.setTimeout(function() {
                pub.callback(pid, false, "Bridge Object is inactive");
            }, 0);
        } else {
            console.log('xrebridge: ' + msg);
        }
    };

  /**
   * Sends a raw message to the XRE environment using the Bridge Object.
   * Returns a new $badger promise to handle the asynchronous response,
   * @param action {string} the action
   * @param args {{}} the arguments to that action
   * @param success {function} the method that will be invoked on success
   * @param failure {function} the method that will be invoked on failure
   * @returns {$badger.promise}
   */
    pub.sendAsync = function(action, args, success, failure) {
      var p = pub.promise(success, failure);
      pub.send(action, args, p.pid);
      return p;
    };

    /**
     * Allows for injection of configuration for the $badger library. Specifically this allows you to define
     * the following configuration values:
     *
     *   - toJson: the method to convert to a JSON string (Default is JSON.stringify)
     *   - fromJson: the method to convert from a JSON string (Default is JSON.parse)
     *   - xscd: the already known xscd information (@see $badger.xscd)
     *
     * @param cfg
     */
    pub.config = function (cfg) {
        if (cfg.toJson) { pri.toJson = cfg.toJson; }
        if (cfg.fromJson) { pri.fromJson = cfg.fromJson; }

        if (typeof(cfg.xscd) != "undefined") { pri.xscd = cfg.xscd; }
    };

    /**
     * Get basic information about the device / user where this is running. This will include the following values:
     *
     *   - zipcode
     *   - timezone (example format "-08:00")
     *   - receiverId (used for logging)
     *
     * These values will be passed as an object to the success method. These values will be cached locally to reduce
     * the number of calls across the wire. When using a cached value, it will invoke the success method asynchronously
     * to maintain a common asynchronous control flow.
     *
     * @param [success] {function} the method that will be invoked on success
     * @param [failure] {function} the method that will be invoked on failure
     *
     * @returns {$badger.promise}
     */
    pub.info = function(success, failure) {
        return pub.sendAsync('info', null, success, failure);
    };

    pub.deviceCapabilities = function() {
        return pub.sendAsync('deviceCapabilities', null);
    };

    /**
     * Get last reboot information. This will include the following values:
     *   - timestamp
     *   - source
     *
     * @returns Last reboot information from the device.
     */
    pub.getPreviousRebootInfo = function() {
      return pub.sendAsync('getSystemInfo', {device_info: 'reboot_info'}, null, null);
   };

    /**
     * Get parental control information about the device / user where this is running. This will include the following values:
     *
     *   - contentPINEnabled
     *   - purchasePINEnabled
     *   - hideTVMA
     *   - hideAdult
     *   - purchasePINEnabled
     *   - hideTVMA
     *   - safeSearch
     *   - blockMissingMetadata
     *   - tvRatingLocks
     *   - ratingAdvisoryLocks
     *   - movieRatingLocks
     *   - stationLocks
     *   - serviceLocks
     *   - timeLocks
     *   - titleLocks
     *
     * These values will be passed as an object to the success method.
     *
     * @param [success] {function} the method that will be invoked on success
     * @param [failure] {function} the method that will be invoked on failure
     *
     * @returns {$badger.promise}
     */
    pub.parentalControlInfo = function(success, failure) {
      return pub.sendAsync('parentControlInfo', null, function(pc_info) {
        pri.pc_info = pc_info;
        success(pc_info);
      }, failure);
    };

    /**
     * Verify content_pin about the device / user where this is running. Return true or false according to the verification result.
     *
     * @param [pin] {string} the pin that user input
     * @param [success] {function} the method that will be invoked on success
     * @param [failure] {function} the method that will be invoked on failure
     *
     * @returns {$badger.promise}
     */
    pub.verifyPin = function(pin, success, failure) {
      return pub.sendAsync('verifyPin', {'content_pin': pin}, function(info) {
        success(info);
      }, failure);
   };

   /**
    * Verify purchase_pin of the device/user where this is running.
    * Return true or false according to the verification result.
    *
    * @param [purchasePin] {string} the purchase pin provided by the user
    * @param [success] {function} the method that will be invoked on success
    * @param [failure] {function} the method that will be invoked on failure
    *
    * @returns {$badger.promise}
    */
   pub.verifyPurchasePin = function(purchasePin, success, failure) {
     return pub.sendAsync('verifyPurchasePin', {'purchase_pin': purchasePin}, function(info) {
       success(info);
     }, failure);
  };

    /**
     * Get xscd encrypted-base64 encoded string.
     *
     * These values will be passed as an object to the success method. These values will be cached locally to reduce
     * the number of calls across the wire. When using a cached value, it will invoke the success method asynchronously
     * to maintain a common asynchronous control flow.
     *
     * @param [success] {function} the method that will be invoked on success
     * @param [failure] {function} the method that will be invoked on failure
     *
     * @returns {$badger.promise}
     */
    pub.xscd = function(success, failure) {

        var p = null;

        if (pri.xscd && pri.xscd_expiry > Date.now()) {
            p = pub.promise(success, null);

            setTimeout(function() {
                pub.callback(p.pid, true, pri.xscd);
            }, 0);
        } else {
            /* In this case, we are going to intercept the success to store off the info for future use */
            p = pub.sendAsync('xscd', null, function(xscd) {
              pri.xscd_expiry = Date.now()+90*1000;
              pri.xscd = xscd;
              success(xscd);
            }, failure);
        }

        return p;
    };

    /**
     * This method was insecure and has been replaced by $badger.xscd(). The failure method will be called every time.
     *
     * @deprecated (since 10/7/2014) use $badger.xscd instead.
     *
     * @param [success] {function} the method that will be invoked on success
     * @param [failure] {function} the method that will be invoked on failure
     *
     * @returns {$badger.promise}
     */
    pub.xscdInfo = function(success, failure) {
        var p = pub.promise(success, failure);

        setTimeout(function() {
            pub.callback(p.pid, false, "$badger.xscdInfo() method not available, use $badger.xscd()");
        }, 0);

        return p;
    };

    /**
     * Displays authOverlay in Chariot. It returns the XSCD encrypted information on the selected user.
     * @param [authParams] {{}} the AuthOverlay parameters specific to the application.
     *
     * @returns {$badger.promise}
     */
    pub.showAuthOverlay = function() {
      if(typeof arguments[0] === 'object') {
        return pub.sendAsync('showAuthOverlay', arguments[0]);
      } else if(arguments.length === 3 && typeof arguments[2] === 'object') {
        var success = arguments[0];
        var failure = arguments[1];
        var authParams = arguments[2];
        return pub.sendAsync('showAuthOverlay', authParams, success, failure);
      }
      throw new Error('Invalid params');
    };

    /**
     * Displays the content PIN overlay in Chariot. It returns the status of validation.
     * This method returns a promise to which success and failure callbacks can be set
     * Usage:
     *
     *      var p = $badger.showContentPinOverlay();
     *      p.success(function(data){...});
     *      p.failure(function(data){...});
     *
     *      or
     *
     *      $badger.showContentPinOverlay().success(function(data){...}).failure(function(data){...});
     *
     *      The success callback returns a JSON containing the fields status and message.
     *                   Possible statuses: messages are:
     *                   - SUCCESS: Successful Pin validation
     *                   - PIN_NOT_REQUIRED: Pin not required: content_pin not enabled
     *      The failure callback returns a JSON containing the fields status and message.
     *                   Possible statuses: messages are:
     *                   - LOCKED: Maximum attempts exceeded. Wait <x> minute(s) before retrying
     *                   - USER_DISMISSED_OVERLAY: User dismissed Pin overlay
     *                   - PARENT_CONTROL_QUERY_ERROR: Failed to query Parental Control Info
     *                   - SERVICE_COMMUNICATION_ERROR: Failed to communicate with PinOverlayService
     *                   - OVERLAY_LAUNCH_ERROR: Failed to launch Pin Overlay
     *                   - OVERLAY_ALREADY_LAUNCHED: Invalid state, a Pin overlay has already been launched
     * @returns {$badger.promise}
     */
    pub.showContentPinOverlay = function() {
        var p = null;
        p = pub.promise();
        pub.send("showPinOverlay", {pin_type: 'content_pin'}, p.pid);
        return p;
    };

    /**
     * Displays the purchase PIN overlay in Chariot. It returns the status of validation.
     * This method returns a promise to which success and failure callbacks can be set
     * Usage:
     *
     *      var p = $badger.showPurchasePinOverlay();
     *      p.success(function(data){...});
     *      p.failure(function(data){...});
     *
     *      or
     *
     *      $badger.showPurchasePinOverlay().success(function(data){...}).failure(function(data){...});
     *
     *      The success callback returns a JSON containing the fields status and message.
     *                   Possible statuses: messages are:
     *                   - SUCCESS: Successful Pin validation
     *                   - PIN_NOT_REQUIRED: Pin not required: purchase_pin not enabled
     *      The failure callback returns a JSON containing the fields status and message.
     *                   The failure callback returns a JSON string containing the fields status and message.
     *                   Possible statuses: messages are:
     *                   - LOCKED: Maximum attempts exceeded. Wait <x> minute(s) before retrying
     *                   - USER_DISMISSED_OVERLAY: User dismissed Pin overlay
     *                   - PARENT_CONTROL_QUERY_ERROR: Failed to query Parental Control Info
     *                   - SERVICE_COMMUNICATION_ERROR: Failed to communicate with PinOverlayService
     *                   - OVERLAY_LAUNCH_ERROR: Failed to launch Pin Overlay
     *                   - OVERLAY_ALREADY_LAUNCHED: Invalid state, a Pin overlay has already been launched
     * @returns {$badger.promise}
     */
    pub.showPurchasePinOverlay = function() {
        var p = null;
        p = pub.promise();
        pub.send("showPinOverlay", {pin_type: 'purchase_pin'}, p.pid);
        return p;
    };

    /**
     * Make a call back to the Chariot server to create a performance monitoring log of type
     * launchMetrics. The segmentName is free-form and can be defined on a per application
     * basis although it is most helpful if it is named in agreement with those who will be
     * monitoring the peformance logs.
     *
     * @param segmentName {string} name of the performance segment being tracked
     * @param [args] {{}} the optional arguments to include with the metrics
     *
     * @returns {$badger.promise}
     */
    pub.metricsHandler = function(segmentName, args) {
      return pub.sendAsync('metricsHandler', {segment: segmentName, evt: args});
    };

    /**
     * Make a call back to the Chariot server to create a performance monitoring log of type
     * launchMetrics and indicate that the application is loaded and ready for use by the
     * user.
     *
     * @returns {$badger.promise}
     * @param [args] {{}} the optional arguments to include with launchCompleted metrics
     */
    pub.launchCompletedMetricsHandler = function(args) {
        return pub.metricsHandler("LAUNCH_COMPLETED", args);
    };

    /**
     * Method to dismiss the loading of dynamic splash screen and indicate
     * the application is loaded and ready for use by the user.
     *
     * @returns {$badger.promise}
     */
    pub.dismissLoadingScreen = function() {
        return pub.sendAsync('dismissLoadingScreen');
    };

    /**
     * Make a call back to the Chariot server to create a user action log
     * when the user initiates an action that is successfully completed by the application
     *
     * @param action {String} Name of the action that was successfully completed.
     * @param [args] {{}} the optional arguments to include with the user action
     *
     * @returns {$badger.promise}
     */

    pub.userActionMetricsHandler = function(action, args) {
        var ts = new Date().getTime();
        var event = {
            eventType: 'userAction',
            action: action,
            evt:  args
        };

        return pub.sendAsync("metricsHandler", event);
    };

    /**
     * Make a call back to the Chariot server to create an application action log.
     *
     * @param action {String} Name of the action that was successfully completed.
     * @param [args] {{}} the optional arguments to include with the app action
     *
     * @returns {$badger.promise}
     */

    pub.appActionMetricsHandler = function(action, args) {
        var ts = new Date().getTime();
        var event = {
            eventType: 'appAction',
            action: action,
            evt:  args
        };

        return pub.sendAsync("metricsHandler", event);
    };


    /**
     * Make a call back to the Chariot server to create a page view log
     * when the user navigate to a new page.
     *
     * @param page {String} the name of the page
     * @param [args] {{}} the optional arguments to include with the page view
     *
     * @returns {$badger.promise}
     */

    pub.pageViewMetricsHandler = function(page, args) {
        var ts = new Date().getTime();
        var event = {
            eventType: 'pageView',
            page: page,
            evt: args
        };

        return pub.sendAsync("metricsHandler", event);
    };

    /**
     * Make a call back to the Chariot server to create a user error log
     * when the user tries to perform an action that is not permitted.
     *
     * @param message {string} The error message text.
     * @param visible {boolean} Was the error displayed to the user in the application.
     * @param code {string} The error code
     * @param [args] {{}} the optional arguments to include with the user action
     *
     * @returns {$badger.promise}
     */

    pub.userErrorMetricsHandler = function(message, visible, code, args) {
        var ts = new Date().getTime();
        var event = {
            eventType: 'userError',
            errMsg : message,
            errVisible : visible,
            errCode: code,
            evt: args
        };

        return pub.sendAsync("metricsHandler", event);
    };

    /**
     * Make a call back to the Chariot server to create an error log
     * for an error that occurs during execution of the application.
     *
     * @param message {string} The error message text.
     * @param visible {boolean} Was the error displayed to the user in the application.
     * @param code {string} The error code
     * @param [args] {{}} the optional arguments to include with the user action
     *
     * @returns {$badger.promise}
     */

    pub.errorMetricsHandler = function(message, visible, code, args) {
        var ts = new Date().getTime();
        var event = {
            eventType: 'error',
            errMsg : message,
            errVisible : visible,
            errCode: code,
            evt: args
        };

        return pub.sendAsync("metricsHandler", event);

    };

    /**
     * Close the Webkit window and return back to the last known location.
     *
     * @returns {$badger.promise}
     */
    pub.shutdown = function() {
        return pub.sendAsync('shutdown', null);
    };

    /**
     * Displays on overlay toaster with the specified title, msg, timeout and btn text
     *
     * The following fields are ignored: pid, line2, timeout, btnText
     *
     * @deprecated use {@link $badger.displayError}
     */
    pub.showOverlay = function(pid, title, line1, line2, timeout, btnText) {
        if (typeof title == "undefined" || title === null || line1 === null || typeof line1 == "undefined") {
            throw "To display on overlay, developer must set the title and msg";
        }
      return pub.sendAsync("showoverlay", {title: title, lineone: line1, linetwo: line2, timeout: timeout, buttonText: btnText }, pid);
    };

    /**
     * Displays an overlay toaster with the specified title and body message. When the user clicks either 'OK' or
     * 'Cancel' then the application will automatically dismiss.
     *
     * There is no automatic exit of the app after a timeout. If it is desirable that the application should dismiss
     * automatically after some time, this should be done by calling {@link $badger.shutdown} in response to a timer.
     *
     * @param title the title of the error message
     * @param body the body of the error message
     *
     * @returns {$badger.promise}
     */
    pub.displayError = function(title, body) {
      return pub.sendAsync('displayError', { title: title, body: body });
    };

    /**
     * Displays an overlay toaster with a pre-defined message. Messages are pre-defined by Comcast and identified by labels.
     * Please work with Comcast to determine the appropriate message label to use.
     *
     * @param message the message label
     *
     * @returns {$badger.promise}
     */
    pub.showToaster = function(message) {
      return pub.sendAsync('showToaster', { message: message });
    };

  /**
   * Resize video player
   * @param x
   * @param y
   * @param width
   * @param height
   *
   * @returns {$badger.promise}
   */
    pub.resizevideo = function(x,y, width, height){
    	if(typeof x == "undefined" || x === null || typeof y == "undefined"|| y === null || typeof width == "undefined"|| width === null
    	|| typeof height == "undefined"|| height === null){
    		  throw "To resize the video, developer must provide geometry";
    	}
        return pub.sendAsync("resizeVideo", {x: x, y : y, width: width,height: height});
    };

    /**
     * Log a single message into the XRE environment.
     *
     * @param level {string} the level
     * @param msg {*} the message
     *
     * @returns {$badger.promise}
     */
    pub.log = function(level, msg) {
      return pub.sendAsync('log', { level : level, msg : msg });
    };

    /**
     * A simple logger that will push log messages into the XRE environment.
     *
     * @name $badger.logger
     */
    pub.logger = {};

    /**
     * Log a message at the FATAL level.
     * @param msg the message to log
     */
    pub.logger.fatal = function(msg) { pub.log('fatal', msg); };

    /**
     * Log a message at the ERROR level.
     * @param msg the message to log
     */
    pub.logger.error = function(msg) { pub.log('error', msg); };

    /**
     * Log a message at the WARN level.
     * @param msg the message to log
     */
    pub.logger.warn = function(msg) { pub.log('warn',  msg); };

    /**
     * Log a message at the INFO level.
     * @param msg the message to log
     */
    pub.logger.info = function(msg) { pub.log('info',  msg); };

    /**
     * Log a message at the DEBUG level.
     * @param msg the message to log
     */
    pub.logger.debug = function(msg) { pub.log('debug', msg); };

    /**
     * Log a message at the TRACE level.
     * @param msg the message to log
     */
    pub.logger.trace = function(msg) { pub.log('trace', msg); };

    /**
     * Mute or unmute the background video.
     * @deprecated
     * @param [mute=true] {boolean} if true, mute the background video, otherwise unmute
     *
     * @returns {$badger.promise}
     */
    pub.mute = function(mute) {
        return pub.toggleVideo(!mute);
    };

    /**
     * Unmute the background video.
     * @deprecated
     *
     * @returns {$badger.promise}
     */
    pub.unmute = function() {
        return pub.mute(false);
    };

    /**
     * Toggle the background video audio.
     * @param [audio=true] {boolean} if true, enable the background video audio, otherwise disable.
     *
     * @returns {$badger.promise}
     */
    pub.toggleAudio = function(audio) {
      return pub.sendAsync('video', { toggleAudio : !!audio });
    };

    /**
     * Toggle the background video.
     * @param [video=true] {boolean} if true, enable the background video, otherwise disable.
     *
     * @returns {$badger.promise}
     */
    pub.toggleVideo = function(video) {
      return pub.sendAsync('video', { toggleVideo : !!video });
    };

    /**
     * Invoke a deeplink to an XRE location using the deeplink URI.
     *
     * @param uri the location to launch
     *
     * @returns {$badger.promise}
     */
    pub.deeplink = function(uri) {
      return pub.sendAsync('deeplink', { uri: uri });
    };

    /**
     * Simple query to determine if this is running on a STB.
     *
     * @returns {boolean} true if this is on a STB, otherwise false
     */
    pub.active = function() {
        return !!pri.bridge;
    };

    /**
     * This method is called asynchronously as a callback from the running STB environment.
     *
     * @param pid {number} the promise ID
     * @param success {boolean} if true, call the promises success method, otherwise call the failure method
     * @param json {String|Object} the payload to pass to the object, if a String, we will attempt to convert to an Object
     */
    pub.callback = function (pid, success, json) {
        var promise = pri.promises[pid];
        delete pri.promises[pid];

        if (!promise) {
            if(!success) {
              console.error(json);
            }
            return;
        }

        promise.cancelTimeout();

        var method = success ? promise.success : promise.failure;
        if (!method) {
            if(!success) {
              console.error(json);
            }
            return;
        }

        if (typeof(json) == "string" && (json.charAt(0) == '{' || json.charAt(0) == '[')) {
            json = pri.fromJson(json);
        }

        method(json);
    };

    /**
     * An analytics engine library for easily tracking page views and user events for consumption by Comcast.
     * Note that appLaunch and appExit are NOT tracked here. This is taken care of by the containing application
     * within the Comcast application space. HTML applications are not responsible for that logging here.
     *
     * @name $badger.analytics
     */
    pub.analytics = {};

    /**
     * The configuration for the analytics. This contains common configuration for analytics logging like the
     * application name. Currently this holds the following values:
     *
     *   - appName: the unique key for this application
     *
     * @name $badger.analytics.config
     */
    pub.analytics.config = {
        appName : 'undefined'
    };

    /**
     * Common logging for an analytics event. This is used to add the following fields:
     *
     *   - ts (the timestamp in UTC millis)
     *   - receiverId (obtained by calling $badger.info)
     *   - app (from $badger.analytics.config.appName)
     *
     * @private
     * @param evt {Object} the event to log
     */
    pub.analytics.event = function(evt) {
        var ts = new Date().getTime();

        pub.info(function(info) {
            pub.logger.info({
                ts : ts,
                receiverId : info.receiverId,
                app : pub.analytics.config.appName,
                evt : evt
            });
        });
    };

    /**
     * Log a page view event.
     *
     * @param page {String} the name of the page
     * @param [args] {{}} the optional arguments to include with the page view
     */
    pub.analytics.pageView = function(page, args) {
        var val = args || {};
        val.page = page;

        pub.analytics.event({
            type: 'pageView',
            val: val
        });
    };

    /**
     * Logged when the user initiates an action that is successfully completed by the application (e.g. started the
     * playback of a video asset).
     *
     * @param action {String} Name of the action that was successfully completed.
     * @param [args] {{}} the optional arguments to include with the user action
     */
    pub.analytics.userAction = function(action, args) {
        var val = args || {};
        val.action = action;

        pub.analytics.event({
            type: 'userAction',
            val: val
        });
    };

    /**
     * Logged when an error occurs during execution of the application (whether it was displayed to the user or not).
     *
     * @param visible {boolean} Was the error displayed to the user in the application.
     * @param message {string} The error message text.
     */
    pub.analytics.error = function(visible, message) {
        pub.analytics.event({
            type: 'error',
            val: {
                errVis: visible,
                errMsg: message
            }
        });
    };

    /**
     * This event should be logged when the user tries to perform an action that is not permitted (e.g. enter an
     * invalid phone number).
     *
     * @param visible {boolean} Was the error displayed to the user in the application.
     * @param message {string} The error message text.
     */
    pub.analytics.userError = function(visible, message) {
        pub.analytics.event({
            type: 'userError',
            val: {
                errVis: visible,
                errMsg: message
            }
        });
    };

   /**
     * Requesting OAuthBearerToken from CIMA.
     *
     * @param [clientId] {string} client id
     * @param [success] {function} the method that will be invoked on success
     *                   The success callback returns a JSON containing the following fields:
     *                   - access_token: an account-level token
     *                   - expires_in
     *                   - token_type
     *                   - scope
     *                   - tid: hash of primary user's custGuid of the account
     * @param [failure] {function} the method that will be invoked on failure
     *
     * @returns {$badger.promise}
     */
   pub.getBearerToken = function(clientId, success, failure) {
      return pub.sendAsync('OAuthBearerToken', {client_id: clientId}, success, failure);
    };

   /**
     * Track when $badger is loaded for launch metric tracking
     * startTime argument is inserted when $badger gets injected
     * To inject $badger, set Chariot config loadMoneyBadger=true when launching an app
     */
   pub.logMoneyBadgerLoaded = function(startTime) {
        if (startTime!=null) {
            pub.send('logMoneyBadgerLoaded', {startTime: startTime});
        }
   };

   pub.fireDocumentEvent = function(input) {
       var d = new Event(input);
       document.dispatchEvent(d);
   };

   pri.appAuth = {};

   pri.appAuth.get = function() {
       var event = {
           operation: "get"
       };
       return pub.sendAsync('appAuth', event, null, null);
   };

   pri.appAuth.upsert = function(userId, data) {
       var event = {
           operation: "upsert",
           userId: userId,
           data: data
       };
       return pub.sendAsync('appAuth', event, null, null);
   };

   pri.appAuth.delete = function() {
       var event = {
           operation: "delete"
       };
       return pub.sendAsync('appAuth', event, null, null);
   };

   pub.getAppAuth = function() {
       return pri.appAuth;
   };

   pri.userPreferences = {};

   var promptEmail = function(prefillType, opts) {
	   opts = opts || {};
       var event = {
           prefillType: prefillType,
           headerText: opts.headerText,
           selectNoneText: opts.selectNoneText
       };
       return pub.sendAsync('promptEmail', event, null, null);
   };

   pri.userPreferences.promptSignInEmail = function(opts) {
	   return promptEmail("signIn", opts);
   };

   pri.userPreferences.promptSignUpEmail = function(opts) {
	   return promptEmail("signUp", opts);
   };

   /**
    * Gets a list of settings that are booleans
    * @keys an array of keys to get settings for. eg. CC_STATE, VOICE_GUIDANCE_STATE
    */
   pri.userPreferences.settings = function (keys) {
        return pub.sendAsync('settings', { keys: keys }, null, null);
   }

   /**
    * Gets a single setting, this handles the promise bridging between the API call and what the
    * caller sets for the promise of the single setting
    */
    pri.userPreferences.setting = function (key) {
        var settingsPromise = pri.userPreferences.settings([key]);
        return pri.wrapPromise(settingsPromise, settings => {
            return settings[key];
        });
    }

    pri.userPreferences.closedCaptioning = function () {
        return pri.userPreferences.setting("CC_STATE");
    };

    pri.userPreferences.voiceGuidance = function () {
        return pri.userPreferences.setting("VOICE_GUIDANCE_STATE");
    };

    pub.userPreferences = function() {
        return pri.userPreferences;
    };

    pri.accountLink = {}

    pri.accountLink.signIn = function(subscriptionEntitlements) {
        return pub.sendAsync('entitlementsAccountLink', { action: "signIn", subscriptionEntitlements: subscriptionEntitlements }, null, null);
    }

    pri.accountLink.signOut = function() {
        return pub.sendAsync('entitlementsAccountLink', { action: "signOut" }, null, null);
    }

    pri.accountLink.appLaunch = function(subscriptionEntitlements) {
        return pub.sendAsync('entitlementsAccountLink', { action: "appLaunch", subscriptionEntitlements: subscriptionEntitlements }, null, null);
    }

    pri.accountLink.updateEntitlements = function(subscriptionEntitlements) {
        return pub.sendAsync('entitlementsAccountLink', { type: "entitlementsUpdate", subscriptionEntitlements: subscriptionEntitlements }, null, null);
    }

    pri.accountLink.mediaEvent = function(mediaEvent) {
        return pub.sendAsync('mediaEventAccountLink', { event: mediaEvent }, null, null);
    }

    pub.accountLink = function() {
        return pri.accountLink;
    }

    /**
     * Compare App Settings with X1 settings
     */
    pri.accountLink.compareAppSettings = function(appSettings) {
       return pub.sendAsync('compareAppSettings', { settings: appSettings }, null, null);
    };

   return pub;

})();