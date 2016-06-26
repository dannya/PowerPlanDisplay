'use strict';

/*!
 * PowerPlanDisplay
 * https://github.com/dannyakakong/powerplandisplay
 *
 * (c) 2016 Danny Allen / Wonderscore Ltd
 * http://dannya.com
 *
 * License: GPL-v3
 */


const ipc = io(window.location.origin);


// define angular components
var PowerPlanDisplay = angular.module('PowerPlanDisplay', ['ui.select', 'ngSanitize', 'ngAnimate']);

angular.module('PowerPlanDisplay')
    .controller('PowerPlanDisplayCtrl', ['$scope', '$parse', function ($scope, $parse) {

        // determine context and page
        var context     = 'browser',
            urlQuery    = window.location.search.substring(1).split('&');

        for (var i = 0; i < urlQuery.length; i++) {
            var pair = urlQuery[i].split('=');

            if (decodeURIComponent(pair[0]) === 'context') {
                context = decodeURIComponent(pair[1]);
                break;
            }
        }


        // kick off powerplandisplay data retrieval
        ipc.emit(
            'initialise',
            context
        );


        // on setData, set specified powerplandisplay values into scope
        ipc.on(
            'setData',
            function (payload) {
                $parse(payload.keyPath.join('.'))
                    .assign(
                        $scope,
                        payload.data
                    );

                $scope.$apply();
            }
        );


        // once we have received the powerplans, extract and set the active powerplan
        $scope.$watch(
            'powerplans',
            function (newVal) {
                if (newVal) {
                    // set active powerplan
                    for (var i in newVal) {
                        if (newVal[i].active) {
                            $scope.activePowerplan = {
                                value: newVal[i]
                            };

                            break;
                        }
                    }
                }
            }
        );


        // handle changing of active powerplan (bi-directional)
        $scope.activePowerplan = null;

        $scope.changeActivePowerplan = function (item) {
            // update UI
            $scope.activePowerplan = {
                value: item
            };

            // make backend system powerplan change
            ipc.emit(
                'action',
                {
                    fn:         ['fn', 'changeActivePowerplan'],
                    params:     [
                        item.guid
                    ]
                }
            );
        };

    }]);