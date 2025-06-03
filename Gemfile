source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 3.0.2"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
gem 'concurrent-ruby', '< 1.3.4'
gem 'rb-readline'
# temporary fix waiting for fastlane team to fix, according to this issue : https://github.com/fastlane/fastlane/issues/29573
gem 'fastlane',
    git:    'https://github.com/visuallization/fastlane.git',
    branch: 'fix/templateName-is-not-an-attribute-on-the-resource-profiles'



# gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
# gem 'xcodeproj', '< 1.26.0'