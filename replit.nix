{ pkgs }: {
  deps = [
    # Handles both Replit nixpkgs channels:
    # - legacy channel has nodejs-16_x (max), no nodejs-18_x
    # - nixpkgs-stable-25_05 dropped nodejs-16_x, has nodejs-18_x+
    (if pkgs ? nodejs-18_x then pkgs.nodejs-18_x else pkgs.nodejs-16_x)
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest
  ];
}
