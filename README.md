pitcher
=====

> Find pitch, note, and detune using the Web Audio API

This is a fork of [cwilso's PitchDetect](https://github.com/cwilso/PitchDetect).
It changes the API from a demo application to a usable interface:

```
pitcher(); /* {
  pitch: Number || undefined,
  note: String || undefined,
  detune: Integer || undefined,
  confidence: Number || undefined
} */
```

For a quick demo, point your browser to http://zzmp/github.io/pitcher.

When the script is run in a browser, the user will automagically be prompted to use their microphone. Once this is done, calling `pitcher()` will return the `pitch`, `note`, `detune`, and `confidence` level - if detectable.
