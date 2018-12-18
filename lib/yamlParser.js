'use strict';
const BbPromise = require('bluebird');
const _ = require('lodash');
const getServerlessConfigFile = require('serverless/lib/utils/getServerlessConfigFile');

module.exports = {
  yamlParse() {
    const servicePath = this.serverless.config.servicePath;
    if (!servicePath) {
      return BbPromise.resolve();
    }

    return getServerlessConfigFile(servicePath)
      .then(svc => {
        const service = svc;
        this.adorn(service);
        // Need to delete variableSyntax to avoid self-matching errors
        this.serverless.variables.loadVariableSyntax();
        delete service.provider.variableSyntax; // cached by adorn, restored by strip
        this.serverless.variables.service = service;

        return this.serverless.variables.populateObject(service);
      })
      .then(populated => {
        let conf = populated;
        this.strip(conf);

        return conf;
      })
      .then(conf => _.get(conf, 'stepFunctions'))
      .then(stepFunctions => {
        if (_.isArray(stepFunctions.stateMachines)) {
          stepFunctions.stateMachines = Object.assign({}, ...stepFunctions.stateMachines);
        }

        return stepFunctions;
      })
      .then(stepFunctions => {
        if (!stepFunctions) {
          return BbPromise.resolve();
        }

        this.serverless.service.stepFunctions = _.defaults(stepFunctions, {
          stateMachines: {},
          activities: []
        });

        _.defaults(this.serverless.pluginManager.cliOptions, {
          stage: this.options.stage || _.get(sls, 'service.provider.stage') || 'dev',
          region: this.options.region || _.get(sls, 'service.provider.region') || 'us-east-1'
        });

        return BbPromise.resolve();
      })
  },

  adorn(svc) {
    const service = svc;

    // service object treatment
    this.cache.serviceService = service.service;
    if (_.isObject(this.cache.serviceService)) {
      service.service = service.service.name;
      service.serviceObject = this.cache.serviceService;
    }
    // provider treatment and defaults
    this.cache.serviceProvider = service.provider;
    if (_.isString(this.cache.serviceProvider)) {
      service.provider = { name: this.cache.serviceProvider };
    }
    service.provider = _.merge(
      {
        stage: 'dev',
        region: 'us-east-1',
        variableSyntax: '\\${([ ~:a-zA-Z0-9._\'",\\-\\/\\(\\)]+?)}'
      },
      service.provider
    );
  },

  strip(svc) {
    const service = svc;

    if (_.isObject(this.cache.serviceService)) {
      service.service = this.cache.serviceService;
      delete service.serviceObject;
    }
    if (_.isString(this.cache.serviceProvider)) {
      service.provider = this.cache.serviceProvider;
    } else {
      // is object
      if (!this.cache.serviceProvider.stage) {
        delete service.provider.stage;
      }
      if (!this.cache.serviceProvider.region) {
        delete service.provider.region;
      }
      if (this.cache.serviceProvider.variableSyntax) {
        service.provider.variableSyntax = this.cache.serviceProvider.variableSyntax;
      }
    }
  },

  getAllStateMachines() {
    if (
      Object.prototype.toString.call(
        this.serverless.service.stepFunctions.stateMachines
      ) !== '[object Object]'
    ) {
      const errorMessage = [
        'stateMachines property is not an object',
        ' Please check the README for more info.'
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }
    return Object.keys(this.serverless.service.stepFunctions.stateMachines);
  },

  getStateMachine(stateMachineName) {
    if (
      stateMachineName in this.serverless.service.stepFunctions.stateMachines
    ) {
      return this.serverless.service.stepFunctions.stateMachines[
        stateMachineName
      ];
    }
    throw new this.serverless.classes.Error(
      `stateMachine "${stateMachineName}" doesn't exist in this Service`
    );
  },

  isStateMachines() {
    if (
      this.serverless.service.stepFunctions != null &&
      this.serverless.service.stepFunctions.stateMachines != null &&
      !_.isEmpty(this.serverless.service.stepFunctions.stateMachines)
    ) {
      return true;
    }
    return false;
  },

  getAllActivities() {
    if (!Array.isArray(this.serverless.service.stepFunctions.activities)) {
      const errorMessage = [
        'activities property is not an array',
        ' Please check the README for more info.'
      ].join('');
      throw new this.serverless.classes.Error(errorMessage);
    }
    return this.serverless.service.stepFunctions.activities;
  },

  getActivity(activityName) {
    if (
      this.serverless.service.stepFunctions.activities.indexOf(activityName) !==
      -1
    ) {
      return activityName;
    }

    throw new this.serverless.classes.Error(
      `activity "${activityName}" doesn't exist in this Service`
    );
  },

  isActivities() {
    if (
      this.serverless.service.stepFunctions != null &&
      this.serverless.service.stepFunctions.activities != null &&
      !_.isEmpty(this.serverless.service.stepFunctions.activities)
    ) {
      return true;
    }
    return false;
  }
};
