{ pkgs }: {
  deps = [
    pkgs.unpackerr
    pkgs.nodejs_22
    # Local whisper.cpp transcription (keyless audio -> text).
    # cmake + gcc + make build whisper-cli on first use; ffmpeg converts audio to wav.
    pkgs.cmake
    pkgs.gcc
    pkgs.gnumake
    pkgs.ffmpeg
  ];
}
