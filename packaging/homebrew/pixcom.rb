# Homebrew Cask for PixCom.
#
# This file does NOT belong in this repo for `brew tap` to find it — Homebrew
# requires taps to live in their own repo named `homebrew-<tapname>`. Treat
# this as the template to copy over. One-time setup:
#
#   1. Create a new GitHub repo named `homebrew-pixcom` under the same
#      account/org as this repo (e.g. baris5d/homebrew-pixcom).
#   2. Copy this file into it as `Casks/pixcom.rb`.
#   3. After each release, update `version` and `sha256` below (see README
#      "Distributing to non-technical users" for the exact commands) and
#      commit that change to the tap repo.
#
# Then anyone can install with:
#
#   brew tap baris5d/pixcom
#   brew install --cask pixcom
#
# and update with:
#
#   brew upgrade --cask pixcom

cask "pixcom" do
  version "0.1.0"
  sha256 "REPLACE_WITH_SHA256_OF_THE_DMG" # shasum -a 256 PixCom-<version>-arm64.dmg

  url "https://github.com/baris5d/PixCom/releases/download/v#{version}/PixCom-#{version}-arm64.dmg"
  name "PixCom"
  desc "Compare a website, image, or Figma frame against another with a pixel-perfect slider overlay"
  homepage "https://github.com/baris5d/PixCom"

  depends_on macos: ">= :big_sur"

  app "PixCom.app"

  zap trash: [
    "~/Library/Application Support/pixcom",
    "~/Library/Preferences/com.pixcom.app.plist",
    "~/Library/Saved Application State/com.pixcom.app.savedState"
  ]
end
