/* This software is derived from github.com/cwilso/PitchDetect : 

> The MIT License (MIT)
> 
> Copyright (c) 2014 Chris Wilson
> 
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
> 
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
> 
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
*/

!function(exports) { 

var shim = {
  AudioContext: window.AudioContext || window.webkitAudioContext,
  getUserMedia: function(dict, cb) {
    try {
      navigator.getUserMedia = 
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;
      navigator.getUserMedia(dict, cb, fail);
    } catch (e) { fail(e); }

    function fail(e) { console.error(e); }
  },
};

var FFT_SIZE = 2048;
var MIN_SAMPLES = 0;
var NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
var isListening = false;
var context = new shim.AudioContext();
var analyser;
var buffer = new Float32Array(FFT_SIZE);

shim.getUserMedia({
  "audio": {
    "mandatory": {
      "googEchoCancellation": "false",
      "googAutoGainControl": "false",
      "googNoiseSuppression": "false",
      "googHighpassFilter": "false"
    },
    "optional": []
  },
}, gotStream);

exports.pitcher = getPitch;

function gotStream(stream) {
    isListening = true;

    // Create an AudioNode from the stream
    var source = context.createMediaStreamSource(stream);

    // Connect the AudioContext
    analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    source.connect(analyser);
    //analyser.connect(context.destination);
}

function getPitch() {
  if (!isListening) { return result(); }

	analyser.getFloatTimeDomainData(buffer); // Alter buffer by reference
	var ac = autoCorrelate(buffer, context.sampleRate);

 	if (ac == -1) { return result(); }
     
  var pitch = ac;
  var note = noteFromPitch(pitch);
  var detune = centsOffFromPitch(pitch, note);

  return result(pitch, note, detune);

  function result(pitch, note, detune) {
    return {
      pitch: pitch,
      note: NOTE_STRINGS[note % 12],
      detune: detune,
    };
  }
}

function autoCorrelate(buffer, sampleRate) {
	var SIZE = buffer.length;
	var MAX_SAMPLES = Math.floor(SIZE / 2);
	var best_offset = -1;
	var best_correlation = 0;
	var rms = 0;
	var foundGoodCorrelation = false;
	var correlations = new Array(MAX_SAMPLES);

	for (var i=0;i<SIZE;i++) {
		var val = buffer[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var lastCorrelation=1;
	for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
		var correlation = 0;

		for (var i=0; i<MAX_SAMPLES; i++) {
			correlation += Math.abs((buffer[i])-(buffer[i+offset]));
		}
		correlation = 1 - (correlation/MAX_SAMPLES);
		correlations[offset] = correlation; // store it, for the tweaking we need to do below.
		if ((correlation>0.9) && (correlation > lastCorrelation)) {
			foundGoodCorrelation = true;
			if (correlation > best_correlation) {
				best_correlation = correlation;
				best_offset = offset;
			}
		} else if (foundGoodCorrelation) {
			// short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
			// Now we need to tweak the offset - by interpolating between the values to the left and right of the
			// best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
			// we need to do a curve fit on correlations[] around best_offset in order to better determine precise
			// (anti-aliased) offset.

			// we know best_offset >=1, 
			// since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
			// we can't drop into this clause until the following pass (else if).
			var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];  
			return sampleRate/(best_offset+(8*shift));
		}
		lastCorrelation = correlation;
	}
	if (best_correlation > 0.01) {
		// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
		return sampleRate/best_offset;
	}
	return -1;
//	var best_frequency = sampleRate/best_offset;
}

function noteFromPitch(frequency) {
	var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
	return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
	return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
	return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
}

}(window);
