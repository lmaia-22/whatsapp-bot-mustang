{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.typescript
    pkgs.chromium
    pkgs.libgbm
    pkgs.libnss
    pkgs.libatk
    pkgs.libdrm
    pkgs.libxkbcommon
    pkgs.libxcomposite
    pkgs.libxdamage
    pkgs.libxfixes
    pkgs.libxrandr
    pkgs.libgbm
    pkgs.pango
  ];
}