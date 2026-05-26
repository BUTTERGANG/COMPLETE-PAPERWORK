{ pkgs }: {
  deps = [
    # Cascade handles all Replit nixpkgs channel variants:
    # stable-25_05 (current): nodejs-18 removed, nodejs-20_x available
    # stable-25_05 (older):   nodejs-18_x + nodejs-20_x available
    # legacy channel:         max is nodejs-16_x
    (if pkgs ? nodejs-20_x then pkgs.nodejs-20_x
     else if pkgs ? nodejs-18_x then pkgs.nodejs-18_x
     else pkgs.nodejs-16_x)
  ];
}
