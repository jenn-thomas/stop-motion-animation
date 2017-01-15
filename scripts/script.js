'use strict';

$( document ).ready( function(){
    //var videoObj = { "video": true };
    var webCamStream;
    var video = document.querySelector('#samVideo');
    var videoSelect = document.querySelector('.selectCamera');
    var selectors = [videoSelect];
    var self = $(document.body);
    var emptyVideo = self.find( '#samEmptyVideo' )[0],
        canvasStream = self.find( '.samCanvas#liveStream' )[0],
        canvasImage = self.find('.samCanvas#currentFrame')[0],
        contextVideo = canvasStream.getContext( '2d' ),
        contextImage = canvasImage.getContext( '2d' ),
        overlay = self.find( '.samOverlay' )[0],
    //    parent = self.parents( '.sam' ),
    //    samContainer = self.find( '.samContainer' ),
        frames = [],    // hold frames (ImageData) in browser for later saving
        fps = 5,        // maybe add ability for user to adjust this
        maxFrames = 60, // this should be option to set in backend
        playing = false,
        showOverlay = true,
        width = 460,
        height = 345,
        submittedFrames = 0,   // number of frames already sent to database
    //    filledTimeline = self.find( '.samFilledTime' )[0],
    //    emptyTimeline = self.find( '.samEmptyTime' )[0],
    //    videoContainer = self.find( '.samVideoContainer' ),
        recButton = self.find( '#record' ),
        playButton = self.find( '#play' );
    //    redoButton = self.find( '.samRedoButton' ),
    //    toggleButton = self.find( '.samToggleOverlay' ),
    //    framesIndicator = self.find( '.samFramesIndicator' )[0];

        canvasImage.setAttribute('width',width);
        canvasImage.setAttribute('height',height);
        overlay.setAttribute('width',width);
        overlay.setAttribute('height',height);

    $('.dropdown > li').hover(function() {
        $(this).children('ul').stop(true, false, true).slideToggle(300);
    });

    var initVideoSteam = function(){
        canvasStream.style.display = "block";
        canvasImage.style.display = "block";
        overlay.style.display = "block";
        emptyVideo.style.display = "none";
        console.log(overlay.width + ' ' + overlay.height)
        console.log(canvasImage.width + ' ' + canvasImage.height)
        // this is the desired interval between frames [ms]
        // try to account for time taken on other things
        var interval = 50;
        var start = new Date().getTime();

        // Every interval, copy the video image to the canvas
        if (video.videoWidth > 0) height = video.videoHeight / (video.videoWidth / width);
        canvasStream.setAttribute('width',width);
        canvasStream.setAttribute('height',height);
        contextVideo.translate(width,0);
        contextVideo.scale(-1,1);
        console.log(contextVideo);
        setInterval(function(){
            if (video.paused || video.ended || playing){
                return
            }
            contextVideo.fillRect(0,0,width,height);
            contextVideo.drawImage(video,0,0,width,height);
        }, interval-((new Date().getTime()-start)%interval));
    };

    var video = $.find( '#samVideo' )[0];
    if (video === undefined) {
        self.append('<video id="samVideo" width="460" height="345" autoplay style="display:none"></video>');
        video = $.find( '#samVideo' )[0];
    }


    function getDevices(deviceInfos) {
     //  Handles being called several times to update labels. Preserve values.
      var values = selectors.map(function(select) {
        return select.value;
      });
      selectors.forEach(function(select) {
        while (select.firstChild) {
          select.removeChild(select.firstChild);
        }
      });
      for (var i = 0; i !== deviceInfos.length; ++i) {
        var deviceInfo = deviceInfos[i];
        var option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'videoinput') {
          option.text = deviceInfo.label || 'camera ' + (videoSelect.length + 1);
            console.log(deviceInfo.label);
          videoSelect.appendChild(option);
        } else {
          console.log('Some other kind of source/device: ', deviceInfo);
        }
      }
      selectors.forEach(function(select, selectorIndex) {
        if (Array.prototype.slice.call(select.childNodes).some(function(n) {
          return n.value === values[selectorIndex];
        })) {
          select.value = values[selectorIndex];
        }
      });
    }

    navigator.mediaDevices.enumerateDevices()
    .then(getDevices)
    .catch(errBack);

    var errBack = function(error) {
        console.log("Video capture error: ", error.code);
    };

    function start() {
      if (window.stream) {
        window.stream.getTracks().forEach(function(track) {
          track.stop();
        });
      }
      var videoSource = videoSelect.value;
      var constraints = {
        video: {deviceId: videoSource ? {exact: videoSource} : undefined}
      };
      navigator.mediaDevices.getUserMedia(constraints)
      .then(function(stream) {
        initVideoSteam();
        window.stream = stream; // make stream available to console
        webCamStream = stream;
        video.srcObject = stream;
        video.play();
        // Refresh button list in case labels have become available
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(getDevices)
      .catch(errBack);
    }

    videoSelect.onchange = start;

    start();

    // controls

     var toggleOverlay = function() {
        showOverlay = !showOverlay;
        var root = "images/";
        if (showOverlay) {
            overlay.style.display = "block";
            toggleButton[0].style.backgroundImage="url("+root+"onion_on.png)";
        }
        else {
            overlay.style.display = "none";
            toggleButton[0].style.backgroundImage="url("+root+"onion_off.png)";
        }
    };

    // calculates the overlay from the last frame
    var renderOverlay = function(toggled) {
        if (toggled)
            toggleOverlay();
        // if we can and are supposed to show the overlay
        if (frames.length > 0 && showOverlay) {
            var ctx = overlay.getContext('2d');
            if ( !(toggled && ctx.getImageData(0,0,1,1).data.length < 0) ) {
                // get the last frame
                var lastFrame = frames[frames.length-1];
                // we need to do a deep copy
                var imageData = ctx.createImageData(width, height);
                imageData.data.set(lastFrame.data);
                // set alpha channel so image is translucent
                // alpha is in range [0-255]:[transparent-opaque]
                for(var i = 0; i < imageData.data.length; i+=4) {
                    imageData.data[i+3] = 100;
                }
                // draw image
                ctx.putImageData(imageData, 0, 0);
            }
        }
    };

    // set visibility of progress bar to reflect number of frames, max frame length
    //var setProgressBar = function() {
    //    var percentFull = frames.length / maxFrames;
    //    var empty = 400 - 400*percentFull;
    //    empty = String(empty)+"px";
    //    emptyTimeline.style.width = empty;
    //};

    //toggleButton.on("click", function() {
    //    if (!playing) {
    //        // toggle state
    //        renderOverlay(true);
    //    }
    //});

    // Trigger photo take
    recButton.on("click", function() {
        if (video.readyState && frames.length < maxFrames && !playing) {
            frames.push(contextVideo.getImageData(0, 0, width, height));
    //        var numFrames = String(frames.length) + "/" + String(maxFrames);
    //        framesIndicator.innerHTML = numFrames;
            //setProgressBar();
            renderOverlay(false);

            // send frame to server
    //        var compId = this.id;
            var frame = convertImageDataToURL(frames[frames.length-1]);
            displayImage();
            //content = {'fps': fps, 'frame': frame, 'frameNum': submittedFrames};
            //obj.saveSamContent(content, compId);
            submittedFrames++;
        }
    });

    recButton.hover(function () {
       $(this).animate({'opacity':'0.7'}, 300);
    },
    function (){
       $(this).animate({'opacity':'1'}, 300);
    });

    playButton.hover(function () {
       $(this).animate({'opacity':'0.7'}, 300);
    },
    function (){
       $(this).animate({'opacity':'1'}, 300);
    });


    // Play back all frames taken so far
    playButton.on("click", function() {
        if (!playing) {
            // start playing the movie
            console.log("playing video");
                playing = true;
                var i = 0;
                var len = frames.length;
                var start = new Date().getTime();
                (function playCallback(i) {
                    if (i < len && playing) {
                        contextImage.putImageData(frames[i], 0, 0);
                        i++;
                        // this is the desired interval between frames [ms]
                        // try to account for time taken on other things
                        var interval = 1000/fps;
                        setTimeout(function() {
                                playCallback(i);
                         }, interval-((new Date().getTime()-start)%interval) );
                    }
                    else {
                        // stop movie, show live stream
                        playing = false;
                        //initVideoStream();
                        }
                    })(i);
                }
                else {
                    // tell loop to stop playing
                    playing = false;
                }
            });

    function resetFrames(){
        playing = false;
        frames.pop();
        submittedFrames--;
        framesIndicator.innerText = submittedFrames+"/"+String(maxFrames);
        overlay.getContext("2d").clearRect( 0, 0, width, height );
        renderOverlay(false);
    //    if (!overlay)
    //        toggleOverlay();
    }

    function displayImage(){
        var lastFrame = frames[frames.length-1];
        // we need to do a deep copy
        var imageData = contextImage.createImageData(width, height);
        imageData.data.set(lastFrame.data);
    //    // set alpha channel so image is translucent
    //    // alpha is in range [0-255]:[transparent-opaque]
    //    for(var i = 0; i < imageData.data.length; i+=4) {
    //        imageData.data[i+3] = 100;
    //    }
         // draw image
        contextImage.putImageData(imageData, 0, 0);

    }

    //clear all frames and images taken so far
    //redoButton.click(function(){
    //    resetFrames();
    //   // var compID = $(this).data('compid');
    ////            $.ajax({
    ////                url  : SP_AJAX_URL,
    ////                type : 'POST',
    ////                data : {
    ////                    action: 'redoSamMovieAJAX',
    ////                    nonce: SP_NONCE,
    ////                    compid: compID
    ////                },
    ////                dataType : 'json',
    ////                success: function(data) {
    ////                    console.log( data );
    ////                },
    ////                error : function(jqXHR, statusText, errorThrown){
    ////                    if(smartpost.sp_postComponent)
    ////                        smartpost.sp_postComponent.showError( errorThrown );
    ////                }
    ////            });
    //    });

    // return a base64 encoded string of the image data
    var convertImageDataToURL = function(imageData) {
        var c, ctx;
        c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        ctx = c.getContext( '2d' );
        ctx.putImageData(imageData, 0, 0);
        c.remove();
        return c.toDataURL();
    }  
})
        