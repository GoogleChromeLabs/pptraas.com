pipeline {
    agent any

    options {
        parallelsAlwaysFailFast()
    }

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['staging', 'prod'],
            description: 'Select ENV'
        )
        gitParameter(
            name: 'BRANCH',
            branchFilter: 'origin/(.*)',
            defaultValue: 'master',
            sortMode: 'ASCENDING_SMART',
            type: 'PT_BRANCH',
            selectedValue: 'TOP',
            quickFilterEnabled: true
        )
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: "${params.BRANCH}", credentialsId: "${env.GIT_CREDENTIALS_ID}", url: "${env.GIT_URL}"
            }

        }

        stage('Compile') {
            steps {
                parallel(
                    java: {
                        sh label: "Compile Java code", script: "rsync -av --delete $WORKSPACE/ /docker-data/docker/htmltopdf/app/"
                    }
                )
            }
        }


        stage ('Deploy') {
            steps {
                script {
                    if (params.ENVIRONMENT != 'prod') {
                        stage ('Deploy on staging') {
                            sh label: 'Stop container', script: "cd ${DOCKER_CONFIG} && sudo /usr/local/bin/docker-compose stop htmltopdf"
                            }

                        stage ('Starting container') {
                            sh 'cd ${DOCKER_CONFIG} && sudo /usr/local/bin/docker-compose build htmltopdf'
                            sh 'cd ${DOCKER_CONFIG} && sudo /usr/local/bin/docker-compose up -d htmltopdf'
                        }
                    }


                    if (params.ENVIRONMENT == 'prod') {
                        stage ('Deploy on production') {
                            script {
                                def IS_APPROVED = input(
                                    message: "Approve release on Production?",
                                    ok: "Yes",
                                    submitter: "admin",
                                    parameters: [
                                        string(name: 'IS_APPROVED', defaultValue: 'Yes', description: 'Deploy to Production?')
                                    ]
                                )
                                if (IS_APPROVED == 'Yes') {
                                    echo 'Deploying on PROD!!!'

                                    script {
                                        env.TARGET_DIR = "${env.JENKINS_HOME}/jobs/${env.JOB_NAME}/workspace/babhelp/web/target/"
                                        env.APP_WAR = sh(returnStdout: true, script: "ls $TARGET_DIR | sed -e 's:\\.[^./]*\$::' |grep HowTank | awk '{print \$1; exit}'").trim()
                                    }

                                    stage ('Prepare resources') {
                                        script {
                                            sh '''#!/bin/bash
                                                cd $TARGET_DIR
                                                aws s3 cp $TARGET_DIR/"$APP_WAR".war s3://howtank-builds-fr --profile howtank_prod
                                            '''
                                        }
                                    }

                                    stage ('Upload application version') {
                                        script {
                                            sh '''#!/bin/bash
                                                cd $TARGET_DIR
                                                aws elasticbeanstalk create-application-version --application-name 'Howtank-App' --version-label "$APP_WAR" --source-bundle S3Bucket=howtank-builds-fr,S3Key=$APP_WAR.war --profile howtank_prod
                                            '''
                                        }
                                    }

                                    stage ('Uploading maps') {
                                        sh label: 'Upload maps', script: "${JENKINS_HOME}/scripts/uplmapssentry.sh"
                                    }

                                } else {
                                    currentBuild.result = "ABORTED"
                                    error "User cancelled"
                                }
                            }
                        }
                    }
                }
            }
        }


        stage ('Verify application started') {
            options {
                timeout(time: 300, unit: 'SECONDS')
            }

            steps {
                    waitUntil {
                        script {
                            def APP_HOSTNAME = params.ENVIRONMENT == 'prod' ? 'www.howtank.com' : "${ENVIRONMENT}.howtank.ninja";

                            def exitCode = sh(returnStatus: true, script: "curl -s --head --request GET  http://htmltopdf.howtank.ninja | grep -o 'HTTP/1.1 200'")
                            return exitCode == 0
                        }
                    }
                }
        }
    }


    post {
        always {
            howtankNotification (
                streamId: 'ccb5e47a4f0311ea909c0a815897bad6ae46634d',
                message: 'Hey @all! ${JOB_NAME} build status from $BRANCH branch to htmltopdf on ${ENVIRONMENT} is ${BUILD_STATUS}',
                accessToken: 'id:howtank_jenkins_jwt',
                notifyAborted: 'false',
                notifyFailure: 'true',
                notifyNotBuilt: 'false',
                notifySuccess: 'true',
                notifyUnstable: 'false',
                notifyBackToNormal: 'true'
            )
            
        }
    }

}