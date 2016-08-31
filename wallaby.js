module.exports = function () {
  return {
    files: [
      'api/**/*.js',
      'config/**/*.*',
      'test/fixtures/**/*.*'
    ],

    tests: ['test/unit/**/*.test.js'],

    setup: function (wallaby) {

      wallaby.delayStart();

      var setupSails = function () {

        var freeport = require('freeport');
        var path = require('path');
        var cp = require('child_process');
        var fs = require('fs');
        var fork = cp.fork;
        var existsSync = fs.existsSync;

        // Replacing buildDictionary.optional to resolve hooks from local node_modules
        var buildDictionary = require('sails/node_modules/sails-build-dictionary');
        var originalOptional = buildDictionary.optional;
        buildDictionary.optional = function () {
          if (~arguments[0].dirname.indexOf('node_modules')) {
            arguments[0].dirname = path.join(wallaby.localProjectDir, 'node_modules');
          }
          return originalOptional.apply(this, arguments);
        };

        // Replacing fork to make sails start grunt in local project folder
        cp.fork = function (file, args, opts) {
          if (file.indexOf('grunt-cli')) {
            opts.cwd = wallaby.localProjectDir;
          }
          return fork.apply(this, arguments);
        };

        // Replacing existsSync to make sails not throw error when it doesn't find node module in wallaby cache.
        // Wallaby will use local node module anyway.
        fs.existsSync = function (filePath) {
          if (filePath && filePath.indexOf(path.join('instrumented', 'node_modules'))) {
            return true;
          }
          return existsSync.apply(this, arguments);
        };

        var Sails = require('sails').Sails;
        var should = require('should');

        var Barrels = require('barrels');

        freeport(function (err, port) {
          if (err) throw err;

          // Lift Sails with test database
          global.sails = new Sails();
          global.sails.load({
            log: {
              level: 'info'
            },
            models: {
              connection: 'test',
              migrate: 'drop'
            },
            port: port
          }, function (err) {
            if (err) {
              if (err) throw err;
              wallaby.start();
            }

            // Load fixtures
            var barrels = new Barrels();

            // Save original objects in `fixtures` variable
            fixtures = barrels.data;

            // Populate the DB
            barrels.populate(function (err) {
              if (err) throw err;
              wallaby.start();
            });
          });
        });
      };

      // if it doesn't work for you, use workers: {recycle: true}
      // http://wallabyjs.com/docs/config/workers.html
      if (global.sails) {
        global.sails.lower(setupSails);
      }
      else {
        setupSails();
      }
    },
    env: {
      type: 'node'
    }
  };
};
