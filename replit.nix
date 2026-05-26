{ pkgs }: {
  deps = [
    # Channel matrix:
    # - nixpkgs-stable-25_05 (current): nodejs-18 removed (EOL), nodejs-20_x available
    # - nixpkgs-stable-25_05 (older):   nodejs-18_x + nodejs-20_x available
    # - legacy channel:                  max is nodejs-16_x, nothing newer
    (if pkgs ? nodejs-20_x then pkgs.nodejs-20_x
     else if pkgs ? nodejs-18_x then pkgs.nodejs-18_x
     else pkgs.nodejs-16_x)
    pkgs.nodePackages.typescript-language-server
    pkgs.replitPackages.jest
  ];
}
