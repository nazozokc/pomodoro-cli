{
  description = "CLI Pomodoro Timer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f (nixpkgs.legacyPackages.${system}));
    in
    {
      packages = forAllSystems (
        { pkgs }:
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "pomodoro-cli";
            version = "1.0.0";

            src = ./.;

            buildInputs = [
              pkgs.nodejs_20
              pkgs.pnpm
            ];

            buildPhase = ''
              pnpm install --frozen-lockfile --ignore-scripts
            '';

            installPhase = ''
              mkdir -p $out/bin
              cp src/index.js $out/bin/pomodoro
              chmod +x $out/bin/pomodoro
            '';

            postFixup = ''
              substituteInPlace $out/bin/pomodoro \
                --replace '#!/usr/bin/env node' '#!${pkgs.nodejs_20}/bin/node'
            '';
          };
        }
      );

      devShells = forAllSystems (
        { pkgs }:
        {
          default = pkgs.mkShell {
            buildInputs = [
              pkgs.nodejs_20
              pkgs.pnpm
            ];
          };
        }
      );
    };
}
